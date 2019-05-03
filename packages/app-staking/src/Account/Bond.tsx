// Copyright 2017-2019 @polkadot/ui-staking authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { I18nProps } from '@polkadot/ui-app/types';
import { ApiProps } from '@polkadot/ui-api/types';
import { CalculateBalanceProps } from '../types';

import BN from 'bn.js';
import React from 'react';
import { AccountId } from '@polkadot/types';
import { IExtrinsic } from '@polkadot/types/types';
import { Button, InputAddress, InputBalance, Modal, TxButton, Dropdown } from '@polkadot/ui-app';
import { withCalls, withApi, withMulti } from '@polkadot/ui-api';
import { compactToU8a } from '@polkadot/util';
import { SIGNATURE_SIZE } from '@polkadot/ui-signer/Checks';
import { ZERO_BALANCE, ZERO_FEES } from '@polkadot/ui-signer/Checks/constants';

import translate from '../translate';
import ValidateController from './ValidateController';

type Props = I18nProps & ApiProps & CalculateBalanceProps & {
  accountId: string,
  controllerId?: AccountId | null,
  isOpen: boolean,
  onClose: () => void
};

type State = {
  bondValue?: BN,
  controllerId: string,
  destination: number,
  extrinsic: IExtrinsic | null,
  maxBalance?: BN
};

const stashOptions = [
  { text: 'Stash account (increase the amount at stake)', value: 0 },
  { text: 'Stash account (do not increase the amount at stake)', value: 1 },
  { text: 'Controller account', value: 2 }
];

const ZERO = new BN(0);

class Bond extends React.PureComponent<Props, State> {
  state: State;

  constructor (props: Props) {
    super(props);

    const { accountId, controllerId } = this.props;

    this.state = {
      controllerId: controllerId ? controllerId.toString() : accountId,
      destination: 0,
      extrinsic: null
    };
  }

  componentDidUpdate (prevProps: Props, prevState: State) {
    const { balances_fees } = this.props;
    const { controllerId, destination, extrinsic } = this.state;

    const hasLengthChanged = ((extrinsic && extrinsic.encodedLength) || 0) !== ((prevState.extrinsic && prevState.extrinsic.encodedLength) || 0);

    if ((controllerId && prevState.controllerId !== controllerId) ||
      (prevState.destination !== destination) ||
      (balances_fees !== prevProps.balances_fees) ||
      hasLengthChanged
    ) {
      this.setMaxBalance();
    }
  }

  render () {
    const { accountId, isOpen, onClose, t } = this.props;
    const { bondValue, controllerId, extrinsic, maxBalance } = this.state;
    const hasValue = !!bondValue && bondValue.gtn(0) && (!maxBalance || bondValue.lt(maxBalance));
    const canSubmit = hasValue && !!controllerId;

    if (!isOpen) {
      return null;
    }

    return (
      <Modal
        className='staking--Bonding'
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
    const { controllerId, bondValue, destination, maxBalance } = this.state;
    const hasValue = !!bondValue && bondValue.gtn(0);

    return (
      <>
        <Modal.Header>
          {t('Bonding Preferences')}
        </Modal.Header>
        <Modal.Content className='ui--signer-Signer-Content'>
          <InputAddress
            className='medium'
            defaultValue={accountId}
            isDisabled
            label={t('stash account')}
          />
          <InputAddress
            className='medium'
            help={t('The controller is the account that will be used to control any nominating or validating actions. Should not match another stash or controller.')}
            label={t('controller account')}
            onChange={this.onChangeController}
            value={controllerId}
          />
          <ValidateController
            accountId={accountId}
            controllerId={controllerId}
          />
          <InputBalance
            autoFocus
            className='medium'
            help={t('The total amount of the stash balance that will be at stake in any forthcoming rounds (should be less than the total amount available)')}
            isError={!hasValue}
            label={t('value bonded')}
            maxValue={maxBalance}
            onChange={this.onChangeValue}
            withMax
          />
          <Dropdown
            className='medium'
            defaultValue={0}
            help={t('The destination account for any payments as either a nominator or validator')}
            label={t('payment destination')}
            onChange={this.onChangeDestination}
            options={stashOptions}
            value={destination}
          />
        </Modal.Content>
      </>
    );
  }

  private nextState (newState: Partial<State>): void {
    this.setState((prevState: State): State => {
      const { api } = this.props;
      const { bondValue = prevState.bondValue, controllerId = prevState.controllerId, destination = prevState.destination, maxBalance = prevState.maxBalance } = newState;
      const extrinsic = (bondValue && controllerId)
        ? api.tx.staking.bond(controllerId, bondValue, destination)
        : null;

      return {
        bondValue,
        controllerId,
        destination,
        extrinsic,
        maxBalance
      };
    });
  }

  private setMaxBalance = () => {
    const { api, system_accountNonce = ZERO, balances_fees = ZERO_FEES, balances_votingBalance = ZERO_BALANCE } = this.props;
    const { controllerId, destination } = this.state;

    const { transactionBaseFee, transactionByteFee } = balances_fees;
    const { freeBalance } = balances_votingBalance;
    // api.derive.balances.votingBalance(accountId!, ({ freeBalance: senderBalance }) => {
      // api.derive.balances.votingBalance(recipientId!, ({ freeBalance: recipientBalance }) => {

    let prevMax = new BN(0);
    let maxBalance = new BN(1);
    let extrinsic;

    while (!prevMax.eq(maxBalance)) {
      prevMax = maxBalance;

      extrinsic = controllerId && destination
        ? api.tx.staking.bond(controllerId, prevMax, destination)
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
      // });
    // });
  }

  private onChangeController = (controllerId: string) => {
    this.nextState({ controllerId });
  }

  private onChangeDestination = (destination: number) => {
    this.nextState({ destination });
  }

  private onChangeValue = (bondValue?: BN) => {
    this.nextState({ bondValue });
  }
}

export default withMulti(
  Bond,
  translate,
  withApi,
  withCalls<Props>(
    'derive.balances.fees',
    ['derive.balances.votingBalance', { paramName: 'accountId' }],
    ['query.system.accountNonce', { paramName: 'accountId' }]
  )
);
