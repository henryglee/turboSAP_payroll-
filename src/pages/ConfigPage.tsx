/**
 * ConfigPage - Original checkbox-based configuration interface.
 *
 * This is the existing UI, kept as a fallback option.
 * Layout: ConfigurationPanel on left, PayrollAreasPanel on right
 */

import { ConfigurationPanel } from '../ConfigurationPanel';
import { PayrollAreasPanel } from '../PayrollAreasPanel';

export function ConfigPage() {

  return (
    <main className="main-container">
      <ConfigurationPanel />
      <PayrollAreasPanel />
    </main>
  );
}
