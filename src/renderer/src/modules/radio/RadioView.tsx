import { tu } from '@/i18n/ui'
import { RadioPanel } from '@/modules/quill/RadioPanel'

export function RadioView(): JSX.Element {
  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="mx-auto max-w-2xl">
        <h2 className="mb-4 font-serif text-2xl">{tu.radioOffline}</h2>
        <RadioPanel />
      </div>
    </div>
  )
}
