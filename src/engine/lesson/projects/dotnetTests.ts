// ─── Test program for .NET project lessons ────────────────────────────────────
//
// Turns a lesson's `test` fence into a C# entry point compiled together with the
// learner's files (console and WPF projects alike). Each `assert` line is checked inside
// its own try/catch, so one failure doesn't hide the rest, and prints the same
// __OC_TEST__ lines every other harness prints (see testRunner.ts parseTestResults).
// Other lines (creating objects, typing, clicking) run in order between them, the same
// interleaving rule as the single-file C# harness. A failure outside an assertion ends
// the run and is reported on stderr with exit code 1.

import { OC_PREFIX, stripTrailingLineComment } from '../testRunner'

export function dotnetTestProgram(testCode: string, { sta }: { sta: boolean }): string {
  const lines = testCode.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'))
  const body: string[] = []
  for (const line of lines) {
    if (!line.startsWith('assert ')) {
      body.push(`            ${line}`)
      continue
    }
    const expr = stripTrailingLineComment(line.slice('assert '.length))
    const label = line.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    body.push(`            try`)
    body.push(`            {`)
    body.push(`                bool __ok = (${expr});`)
    body.push(`                Console.WriteLine("${OC_PREFIX}" + (__ok ? "PASS" : "FAIL") + "|${label}");`)
    body.push(`            }`)
    body.push(`            catch (Exception __e)`)
    body.push(`            {`)
    body.push(`                Console.WriteLine("${OC_PREFIX}ERROR|${label}|" + Describe(__e));`)
    body.push(`            }`)
  }
  return [
    'using System;',
    'using System.Collections.Generic;',
    '',
    'namespace LessonApp;',
    '',
    'static class LessonTests',
    '{',
    // WPF windows can only be created on a single-threaded-apartment thread.
    ...(sta ? ['    [STAThread]'] : []),
    '    static int Main()',
    '    {',
    '        try',
    '        {',
    ...body,
    '        }',
    '        catch (Exception __e)',
    '        {',
    '            Console.Error.WriteLine(Describe(__e));',
    '            return 1;',
    '        }',
    ...(sta ? ['        finally', '        {', '            Ui.CloseAll();', '        }'] : []),
    '        return 0;',
    '    }',
    '',
    // One line saying what went wrong: skips reflection's wrapper exception, and for a
    // XAML error keeps both where in the XAML it happened and the underlying cause.
    '    static string Describe(Exception error)',
    '    {',
    '        var parts = new List<string>();',
    '        for (Exception? current = error; current != null; current = current.InnerException)',
    '        {',
    '            if (current is System.Reflection.TargetInvocationException) continue;',
    '            bool isXaml = current.GetType().FullName == "System.Windows.Markup.XamlParseException";',
    '            parts.Add(isXaml ? "XAML: " + current.Message',
    '                : current.GetType() == typeof(Exception) ? current.Message',
    '                : current.GetType().Name + ": " + current.Message);',
    '            if (!isXaml) break;',
    '        }',
    '        return string.Join(" -> ", parts).Replace("\\r", " ").Replace("\\n", " ").Replace("|", "/");',
    '    }',
    '}',
    '',
  ].join('\n')
}
