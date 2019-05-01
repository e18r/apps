// Copyright 2017-2019 @polkadot/apps authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.

import { Routes } from '../types';

import Template from '@polkadot/app-derive';

export default ([
  {
    Component: Template,
    display: {
      isHidden: false,
      needsAccounts: true,
      needsApi: [
        'derive.accounts.idAndIndex'
      ]
    },
    i18n: {
      defaultValue: 'Derive'
    },
    icon: 'th',
    name: 'derive'
  }
] as Routes);