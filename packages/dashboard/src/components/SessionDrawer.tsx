import Drawer from './Drawer';
import SessionTimeline from './SessionTimeline';
import { useChains } from '../api/queries';
import { LoadingState, EmptyState } from './StatePrimitives';
import type { ChainDTO } from '../api/types';

interface Props {
  open: boolean;
  onClose: () => void;
  appId: string | undefined;
  /** Optional filter: only show chains whose entries include this path. */
  pagePathContains?: string;
  title?: string;
}

/** Drawer that renders matching session chains using SessionTimeline.
 *  Used by Blocked / Paths / Audience pages: clicking a row passes a
 *  pagePathContains filter to drill into the specific session evidence. */
export default function SessionDrawer({ open, onClose, appId, pagePathContains, title }: Props) {
  const { data, isLoading } = useChains({ appId, limit: 50 });

  const chains: ChainDTO[] = (data ?? []).filter(c => {
    if (!pagePathContains) return true;
    return c.entries.some(e => e.path.includes(pagePathContains));
  });

  return (
    <Drawer open={open} onClose={onClose} title={title || '会话明细'} width={640}>
      {isLoading && <LoadingState />}
      {!isLoading && chains.length === 0 && <EmptyState message="此条件下暂无会话" />}
      {chains.length > 0 && <SessionTimeline chains={chains} />}
    </Drawer>
  );
}
