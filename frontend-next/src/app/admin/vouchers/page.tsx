'use client';

import RequireAuth from '../../../components/RequireAuth';
import VoucherMonitoring from '../../../components/VoucherMonitoring';

export default function Page() {
  return (
    <RequireAuth role="admin">
      <VoucherMonitoring />
    </RequireAuth>
  );
}