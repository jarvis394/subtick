import { Segmented } from '@/components/ui/segmented'
import { KIND_FILTERS, type KindFilter } from '@/lib/highlights'

/** The All / Aces / Clutches / Multi-kills / Special filter. */
export const KindTabs = ({
  value,
  onChange,
}: {
  value: KindFilter
  onChange: (kind: KindFilter) => void
}) => <Segmented label="Kind" size="md" value={value} options={KIND_FILTERS} onChange={onChange} />
