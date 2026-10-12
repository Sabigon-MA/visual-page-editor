import { useEditor } from '../../store/elements';
import { AnimationPanel } from './AnimationPanel';
import { LayersPanel } from './LayersPanel';
import styles from './Panels.module.css';
import { PropertiesPanel } from './PropertiesPanel';

export function RightPanel() {
  const panel = useEditor((s) => s.panel);
  const setPanel = useEditor((s) => s.setPanel);
  return (
    <div className={styles.rightPanel}>
      <div className={`${styles.tabs} edit-only`}>
        <div className={`${styles.tab} ${panel === 'props' ? styles.tabActive : ''}`} onClick={() => setPanel('props')}>プロパティ</div>
        <div className={`${styles.tab} ${panel === 'anim' ? styles.tabActive : ''}`} onClick={() => setPanel('anim')}>アニメーション</div>
      </div>
      <div className={`${styles.content} edit-only`}>
        {panel === 'props' ? <PropertiesPanel /> : <AnimationPanel />}
      </div>
      <LayersPanel />
    </div>
  );
}
