/**
 * Turn the browser harness output into committed, readable evidence.
 *
 * Why this is a script and not an inline `node -e` in the workflow: the inline
 * version assumed a complete report object and threw on any partial one (a
 * fatal harness report has no `viewports`), which failed the evidence step and
 * threw away the diagnosis for the third time. Every field here is optional and
 * anything missing is stated as missing, never guessed.
 *
 * Exit code is always 0: producing evidence is not a test result. The verdict
 * is enforced by its own workflow step that reads this markdown.
 */
import {existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync} from 'node:fs'

const DIR = process.env.PORTFOLIO_EVIDENCE_DIR || 'browser-evidence/portfolio'
// Overridable so a test can never write over the committed evidence.
const OUT_DIR = process.env.PORTFOLIO_EVIDENCE_OUT || 'docs/evidence'
const MD = OUT_DIR + '/portfolio-interaction-latest.md'
const JSON_OUT = OUT_DIR + '/portfolio-interaction-latest.json'
const LOG_OUT = OUT_DIR + '/portfolio-interaction-latest-out.txt'

mkdirSync(OUT_DIR, {recursive: true})

const lines = []
const say = (s = '') => lines.push(s)

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

const reportPath = DIR + '/report.json'
const logPath = DIR + '/harness-out.txt'
const report = readJson(reportPath)
const log = existsSync(logPath) ? readFileSync(logPath, 'utf8') : null

if (log !== null) writeFileSync(LOG_OUT, log)
else if (existsSync(LOG_OUT)) writeFileSync(LOG_OUT, '')

if (!report) {
  say('# Dossier interaction evidence — NO REPORT')
  say()
  say('The interaction harness terminated before writing its report.')
  say()
  say('- report.json present: ' + existsSync(reportPath))
  const tail = (log || '').trim().split('\n').slice(-25)
  say('- captured harness output: ' + (log === null ? 'not captured' : tail.length + ' trailing lines'))
  if (tail.length) {
    say()
    say('```')
    for (const l of tail) say(l)
    say('```')
  } else {
    say()
    say('No harness output was captured, so the terminal error is only in the job log.')
  }
  writeFileSync(JSON_OUT, JSON.stringify({report: null, log: tail}, null, 2))
} else {
  const arr = (v) => (Array.isArray(v) ? v : [])
  const viewports = arr(report.viewports)
  const worldViewports = arr(report.worldViewports)
  const worldEntry = arr(report.worldEntry)
  const panels = arr(report.panels)
  const inputPaths = arr(report.inputPaths)
  const failures = arr(report.failures)
  const suites = arr(report.suites)
  const plan = arr(report.plan)

  say('# Dossier interaction evidence — ' + (report.backend || 'unknown backend'))
  say()
  say('- harness finished: ' + (report.finishedAt ? report.finishedAt : 'no (report is partial)'))
  say('- passed: ' + (report.passed === true ? 'yes' : 'no'))
  say('- DOM viewports: ' + (viewports.length ? viewports.join(', ') : 'none recorded'))
  say('- 3D world viewports: ' + (worldViewports.length ? worldViewports.join(', ') : 'none recorded'))
  say('- planned suites: ' + (plan.length ? plan.map((p) => p.kind + '@' + p.viewport).join(', ') : 'none recorded'))
  say('- world entries (real visitor input): ' + worldEntry.length)
  for (const w of worldEntry)
    say('  - ' + (w.suite || '?') + ' · ' + (w.exhibit || '?') + ' -> ' + (w.opened || '?') +
      ' [' + (w.via || '?') + ']')
  const walkSkipped = suites.flatMap((s) => arr(s.walkSkipped))
  say('- walk skipped: ' + JSON.stringify(walkSkipped))
  say('- dossier audits: ' + panels.length + '/' + (viewports.length * 12 || 'n/a'))
  say('- independent input paths (E / ESC / scrim / reopen): ' + inputPaths.length)
  say('- failures: ' + failures.length)
  for (const f of failures)
    say('  - [' + (f.verdict || '?') + '][' + (f.stage || '?') + '] ' + (f.suite || '?') +
      ': ' + (f.error || 'no message'))
  say('- reached stage: ' + JSON.stringify(report.stage || {}))
  if (report.fatal) say('- harness fatal: ' + String(report.fatal).split('\n')[0])
  say('- total ms: ' + (report.totalMs ?? 'n/a'))
  say()
  say('## Verdict')
  say()
  if (!report.finishedAt) {
    say('INCOMPLETE — the harness stopped part way. The failures above say where.')
  } else if (failures.length === 0 && report.passed === true) {
    say('PASS — every planned proof ran and recorded a real result.')
  } else {
    const real = failures.filter((f) => f.verdict === 'REAL_DEFECT').length
    const unproven = failures.filter((f) => f.verdict === 'UNPROVEN_TIME_BUDGET').length
    say('FAIL — ' + real + ' real defect(s), ' + unproven + ' unproven within the time budget.')
    say('Nothing here is reported as passing without a real input and a real result.')
  }

  writeFileSync(JSON_OUT, JSON.stringify(report, null, 2))
}

writeFileSync(MD, lines.join('\n') + '\n')
console.log(lines.join('\n'))
