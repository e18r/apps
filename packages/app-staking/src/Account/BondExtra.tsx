// Copyright 2017-2019 @polkadot/ui-staking authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { I18nProps } from '@polkadot/ui-app/types';
import { ApiProps } from '@polkadot/ui-api/types';
import { CalculateBalanceProps } from '../types';

import BN from 'bn.js';
import React from 'react';
import { Button, InputAddress, InputBalance, Modal, TxButton } from '@polkadot/ui-app';
import { IExtrinsic } from '@polkadot/types/types';
import { withCalls, withApi, withMulti } from '@polkadot/ui-api';
import { compactToU8a } from '@polkadot/util';
import { SIGNATURE_SIZE } from '@polkadot/ui-signer/Checks';
import { ZERO_BALANCE, ZERO_FEES } from '@polkadot/ui-signer/Checks/constants';

import translate from '../translate';

type Props = I18nProps & ApiProps & CalculateBalanceProps & {
  accountId: string,
  isOpen: boolean,
  onClose: () => void
};

type State = {
  maxAdditional?: BN,
  extrinsic: IExtrinsic | null,
  maxBalance?: BN
};

const ZERO = new BN(0);

class BondExtra extends React.PureComponent<Props, State> {
  state: State = {
    extrinsic: null
  };

  componentDidUpdate (prevProps: Props, prevState: State) {
    const { balances_fees } = this.props;
    const { extrinsic } = this.state;

    const hasLengthChanged = ((extrinsic && extrinsic.encodedLength) || 0) !== ((prevState.extrinsic && prevState.extrinsic.encodedLength) || 0);

    if ((balances_fees !== prevProps.balances_fees) ||
      hasLengthChanged
    ) {
      this.setMaxBalance();
    }
  }

  render () {
    const { accountId, balances_votingBalance = ZERO_BALANCE, isOpen, onClose, t } = this.props;
    const { extrinsic, maxAdditional, maxBalance = balances_votingBalance.freeBalance } = this.state;
    const canSubmit = !!maxAdditional && maxAdditional.gtn(0) && maxAdditional.lte(maxBalance);

    if (!isOpen) {
      return null;
    }

    return (
      <Modal
        className='staking--BondExtra'
        dimmer='inverted'
        open
        size='small'
      >
        {this.renderContent()}
        <Modal.Actions>
          <Button.Group>
            <Button
              isNegative
              onClick={onClose}
              label={t('Cancel')}
            />
            <Button.Or />
            <TxButton
              accountId={accountId}
              isDisabled={!canSubmit}
              isPrimary
              label={t('Bond')}
              onClick={onClose}
              extrinsic={extrinsic}
            />
          </Button.Group>
        </Modal.Actions>
      </Modal>
    );
  }

  private renderContent () {
    const { accountId, t } = this.props;
    const { maxBalance } = this.state;

    return (
      <>
        <Modal.Header>
          {t('Bond Extra')}
        </Modal.Header>
        <Modal.Content className='ui--signer-Signer-Content'>
          <InputAddress
            className='medium'
            defaultValue={accountId}
            isDisabled
            label={t('stash account')}
          />
          <InputBalance
            autoFocus
            className='medium'
            help={t('The maximum amount to increase the bonded value, this is adjusted using the available free funds on the account.')}
            label={t('max additional value')}
            maxValue={maxBalance}
            onChange={this.onChangeValue}
            withMax
          />
        </Modal.Content>
      </>
    );
  }

  private nextState (newState: Partial<State>): void {
    this.setState((prevState: State): State => {
      const { api } = this.props;
      const { maxAdditional = prevState.maxAdditional, maxBalance = prevState.maxBalance } = newState;
      const extrinsic = (maxAdditional && maxAdditional.gte(ZERO))
        ? api.tx.staking.bondExtra(maxAdditional)
        : null;

      return {
        maxAdditional,
        extrinsic,
        maxBalance
      };
    });
  }

  private setMaxBalance = () => {
    const { api, system_accountNonce = ZERO, balances_fees = ZERO_FEES, balances_votingBalance = ZERO_BALANCE } = this.props;
    const { maxAdditional } = this.state;

    const { transactionBaseFee, transactionByteFee } = balances_fees;
    const { freeBalance } = balances_votingBalance;

    let prevMax = new BN(0);
    let maxBalance = new BN(1);
    let extrinsic;

    while (!prevMax.eq(maxBalance)) {
      prevMax = maxBalance;

      extrinsic = (maxAdditional && maxAdditional.gte(ZERO))
        ? api.tx.staking.bondExtra(maxAdditional)
        : null;

      const txLength = SIGNATURE_SIZE + compactToU8a(system_accountNonce).length + (
        extrinsic
          ? extrinsic.encodedLength
          : 0
      );

      const fees = transactionBaseFee
        .add(transactionByteFee.muln(txLength));

      maxBalance = new BN(freeBalance).sub(fees);
    }

    this.nextState({
      extrinsic,
      maxBalance
    });
  }

  private onChangeValue = (maxAdditional?: BN) => {
    this.nextState({ maxAdditional });
  }
}

export default withMulti(
  BondExtra,
  translate,
  withApi,
  withCalls<Props>(
    'derive.balances.fees',
    ['derive.balances.votingBalance', { paramName: 'accountId' }],
    ['query.system.accountNonce', { paramName: 'accountId' }]
  )
);
