import { formatCheckCommand, requiredChecks } from './toolchain'

function App() {
  return (
    <main className="app-shell">
      <section className="status-card" aria-labelledby="page-title">
        <p className="eyebrow">TASK T002</p>
        <h1 id="page-title">Monster Research Tactics</h1>
        <p className="lead">
          開発環境の準備が整いました。戦闘カーネルは次のタスクから、Reactとは分離して実装します。
        </p>

        <div className="status-row" role="status">
          <span className="status-dot" aria-hidden="true" />
          <span>Vite + React + TypeScript strict</span>
        </div>

        <h2>検証コマンド</h2>
        <ul className="command-list">
          {requiredChecks.map((check) => (
            <li key={check}>
              <code>{formatCheckCommand(check)}</code>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

export default App
