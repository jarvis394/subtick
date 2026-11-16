import { describe, expect, test } from 'bun:test'
import { parseAppManifest, parseVdf, steamLibraries } from '../src/setup/steam'

const LIBRARY_FOLDERS = `"libraryfolders"
{
	"0"
	{
		"path"		"C:\\\\Program Files (x86)\\\\Steam"
		"label"		""
		"apps"
		{
			"228980"		"1234"
		}
	}
	"1"
	{
		"path"		"D:\\\\SteamLibrary"
		"apps"
		{
			"730"		"60000000000"
			"228980"		"1234"
		}
	}
}
`

describe('Steam library files', () => {
  test('parses nested KeyValues with escapes', () => {
    expect(parseVdf('"a" { "b" "x \\\\ \\"y\\"" "c" { } }')).toEqual({
      a: { b: 'x \\ "y"', c: {} },
    })
  })

  test('lists libraries, the one with CS2 first', () => {
    expect(steamLibraries(LIBRARY_FOLDERS)).toEqual([
      'D:\\SteamLibrary',
      'C:\\Program Files (x86)\\Steam',
    ])
  })

  test('reads nothing from a file that is no library list', () => {
    expect(steamLibraries('garbage {')).toEqual([])
  })

  test("reads CS2's folder and build from its manifest", () => {
    const manifest = `"AppState"\n{\n\t"appid"\t\t"730"\n\t"installdir"\t\t"Counter-Strike Global Offensive"\n\t"buildid"\t\t"26598758"\n}\n`
    expect(parseAppManifest(manifest)).toEqual({
      installdir: 'Counter-Strike Global Offensive',
      buildid: '26598758',
    })
  })
})
