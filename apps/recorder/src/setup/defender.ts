import { powershell, windowsPath } from '../platform'

/** One line per flagged file: when, tab, `file:_C:\...`. */
const LIST_DETECTIONS = [
  'Get-MpThreatDetection | ForEach-Object { $t = $_.InitialDetectionTime.ToUniversalTime().ToString("o");',
  '$_.Resources | Where-Object { $_ -like "file:_*" } | ForEach-Object { "$t`t$_" } }',
].join(' ')

/**
 * Files under `dir` Windows Defender flagged since `since`, from its history (readable without
 * admin rights; the exclusion list is not).
 */
export const defenderDetections = async (dir: string, since = new Date(0)) => {
  const prefix = `${windowsPath(dir).toLowerCase().replace(/\\+$/, '')}\\`
  const { stdout } = await powershell(LIST_DETECTIONS).catch(() => ({ stdout: '' }))
  const files = stdout
    .split(/\r?\n/)
    .map((line) => line.trim().split('\t'))
    .filter(([time, file]) => file && new Date(time!) >= since)
    .map(([, file]) => file!.replace(/^file:_/, ''))
    .filter((file) => file.toLowerCase().startsWith(prefix))

  return [...new Set(files)]
}

/** What to do when Defender takes the Steam emulator for a threat. */
export const defenderHint = (dir: string) =>
  [
    `Windows Defender blocks gbe_fork, the Steam emulator CS2 runs on here. Exclude ${windowsPath(dir)}:`,
    '  Windows Security -> Virus & threat protection -> Manage settings -> Exclusions -> Add an exclusion -> Folder,',
    `  or in an administrator PowerShell: Add-MpPreference -ExclusionPath '${windowsPath(dir)}'`,
    '  Then run setup again.',
  ].join('\n')
