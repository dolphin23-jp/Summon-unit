import { RegionScreen, type RegionScreenProps } from './RegionScreen'

export interface T040RegionScreenProps extends RegionScreenProps {
  readonly onOpenSave: () => void
}

export function T040RegionScreen({
  onOpenSave,
  ...regionProps
}: T040RegionScreenProps) {
  return (
    <div className="t040-region-shell">
      <nav className="t040-region-save-entry" aria-label="セーブ管理">
        <button type="button" className="collection-button" onClick={onOpenSave}>
          セーブスロット
        </button>
      </nav>
      <RegionScreen {...regionProps} />
    </div>
  )
}
