import React from 'react';
import { CompanyProvider } from '../company/CompanyProvider';
import { InboxProvider } from '../inbox/InboxProvider';
import { PetsProvider } from '../pets/PetsContext';
import { ShopCartProvider } from '../shop/ShopCartContext';

/** Account-only providers — kept out of the guest first-visit bundle. */
export default function AuthenticatedProviders({ children }) {
  return (
    <CompanyProvider>
      <InboxProvider>
        <ShopCartProvider>
          <PetsProvider>{children}</PetsProvider>
        </ShopCartProvider>
      </InboxProvider>
    </CompanyProvider>
  );
}
