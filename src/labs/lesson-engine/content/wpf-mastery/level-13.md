---
series: wpf-mastery
level: 13
title: The UI Thread, the Dispatcher and async
lang: csharp
---

# The UI Thread, the Dispatcher and async

Every WPF window is run by **one thread**, the UI thread. It draws the window, handles every click and keystroke, runs every event handler, every binding update and every timer tick, one at a time. If one handler takes two seconds, nothing else happens for two seconds: the window doesn't repaint, buttons don't respond, and after a few seconds Windows labels it "Not Responding". And the rule goes the other way too: **only the UI thread may touch the window's controls**, so work you move to another thread can't simply write its result into a `TextBlock`. This lesson measures both rules, then shows the three tools that respect them: `Dispatcher.Invoke`, `async`/`await`, and `Progress<T>`, plus the one-line mistake that freezes an app forever. You'll make a slow button responsive and safely show readings that arrive on another thread.

It builds on events and lambdas (level 5) and layout (level 8). Level 27 applies the same ideas to view-model commands.

## One Thread Runs the Window

The UI thread runs a loop, the **dispatcher**: take the next piece of work from a queue (a click, a repaint, a timer tick, a layout pass), run it to the end, take the next. This window has a counter that a timer increases every 100 ms, also through that queue, so it shows whether the queue is moving. Each button does two seconds of work. Launch it, click each button, and watch the counter.

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Freeze" Width="420" Height="220">
    <StackPanel Margin="16">
        <TextBlock x:Name="TickText" FontSize="28" Text="0"/>
        <Button x:Name="BlockButton" Content="Work for 2 s on the UI thread" Click="Block_Click" Margin="0,12,0,0"/>
        <Button x:Name="AwaitButton" Content="Work for 2 s with await Task.Run" Click="Await_Click" Margin="0,8,0,0"/>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;
using System.Windows.Threading;

namespace LessonApp;

public partial class MainWindow : Window
{
    private int ticks;

    public MainWindow()
    {
        InitializeComponent();
        // Ticks every 100 ms, on the UI thread: a heartbeat you can watch.
        var timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(100) };
        timer.Tick += (_, _) => TickText.Text = (++ticks).ToString();
        timer.Start();
    }

    private void Block_Click(object sender, RoutedEventArgs e)
    {
        int before = ticks;
        Thread.Sleep(2000);   // stands in for any slow work: a big file, a slow query
        Console.WriteLine($"blocking:  {ticks - before} ticks during 2 s of work (thread {Environment.CurrentManagedThreadId})");
    }

    private async void Await_Click(object sender, RoutedEventArgs e)
    {
        int before = ticks;
        Console.WriteLine($"await: before, on thread {Environment.CurrentManagedThreadId}");
        await Task.Run(() =>
        {
            Console.WriteLine($"await: the work runs on thread {Environment.CurrentManagedThreadId}");
            Thread.Sleep(2000);
        });
        Console.WriteLine($"await: after, back on thread {Environment.CurrentManagedThreadId}: {ticks - before} ticks during 2 s of work");
    }
}
```

Measured with real clicks:

```text
blocking:  0 ticks during 2 s of work (thread 2)
await: before, on thread 2
await: the work runs on thread 7
await: after, back on thread 2: 18 ticks during 2 s of work
```

While `Block_Click` ran, the counter didn't move once: the timer's ticks waited in the queue behind the click, and so did repainting and every other click. The second button did the same two seconds of work and the counter kept going (18 ticks; the rest were lost to scheduling), because the work ran on another thread. (Your thread numbers may differ; what matters is that "before" and "after" are the same thread and the work is a different one.)

The rule this gives you: **an event handler must return quickly.** Anything that takes noticeable time (more than about 50 ms: reading a large file, a network call, a database query, heavy computation) goes off the UI thread.

**CS lens:** This single-threaded design is shared by nearly every UI toolkit: Win32, WinForms, Qt, Android, browsers (JavaScript's event loop), tkinter. Drawing code that can be called from any thread would need locks on every control, which is slow and deadlock-prone; one owner thread with a work queue is simpler and faster. The price is the rule above.

## Only the UI Thread May Touch Controls

Moving work to another thread brings the second rule. Each WPF control remembers the thread that created it, and checks on every property access. This window tries to set a `TextBlock`'s text from a background thread, then does the same through the dispatcher:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Threads" Width="420" Height="220">
    <StackPanel Margin="16">
        <TextBlock x:Name="StatusText" FontSize="18" Text="(nothing yet)"/>
        <Button x:Name="DirectButton" Content="Set the text from a background thread" Click="Direct_Click" Margin="0,12,0,0"/>
        <Button x:Name="DispatcherButton" Content="Ask the UI thread with Dispatcher.Invoke" Click="Dispatcher_Click" Margin="0,8,0,0"/>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;

namespace LessonApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
    }

    private void Direct_Click(object sender, RoutedEventArgs e)
    {
        Task.Run(() =>
        {
            try
            {
                StatusText.Text = "set from a background thread";
            }
            catch (Exception error)
            {
                Console.WriteLine($"{error.GetType().Name}: {error.Message}");
            }
        });
    }

    private void Dispatcher_Click(object sender, RoutedEventArgs e)
    {
        Task.Run(() =>
        {
            var result = $"computed on thread {Environment.CurrentManagedThreadId}";
            Dispatcher.Invoke(() =>
            {
                StatusText.Text = result;
                Console.WriteLine($"{result}, shown by thread {Environment.CurrentManagedThreadId}");
            });
        });
    }
}
```

The first button prints:

```text
InvalidOperationException: The calling thread cannot access this object because a different thread owns it.
```

That's the most common WPF exception once code goes multi-threaded, and its message says exactly what happened. (Without the `try`/`catch`, an exception on a background thread is easy to miss: here it would vanish with its `Task`.) The second button works: `Dispatcher.Invoke(...)` puts a lambda in the UI thread's queue and waits for it to run there. Every control, and the window, has a `Dispatcher` property for this. `Dispatcher.BeginInvoke(...)` does the same without waiting.

Qt's answer to the same problem is a signal connected across threads; tkinter's is `after()`; the browser's is that there are no other threads touching the page.

## Challenge: sensor_feed

A `Sensor` (read-only) sends temperature readings on its own background thread: its `Reading` event fires on that thread, with the temperature as an `int`. In `MainWindow.xaml.cs`, subscribe to `Sensor.Reading` in the constructor and show each reading in the `TextBlock` named `ReadingText` as `"<value> °C"` (for example `"24 °C"`), without touching the control from the sensor's thread. The sensor records any exception a handler throws in `LastError`, and the tests check it.

```challenge wpf file=MainWindow.xaml.cs
using System.Windows;

namespace LessonApp;

public partial class MainWindow : Window
{
    public Sensor Sensor { get; } = new();

    public MainWindow()
    {
        InitializeComponent();
        // TODO: show each reading in ReadingText
    }
}
```

```challenge wpf file=MainWindow.xaml readonly
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Sensor" Width="300" Height="160">
    <TextBlock x:Name="ReadingText" Text="waiting..." FontSize="28" Margin="16"/>
</Window>
```

```challenge wpf file=Sensor.cs readonly
namespace LessonApp;

// Sends readings 20, 21, 22... from a background thread.
public class Sensor
{
    public event EventHandler<int>? Reading;
    public Exception? LastError { get; private set; }
    public int Sent { get; private set; }
    public int ThreadId { get; private set; }

    public void Start(int count) => Task.Run(() =>
    {
        ThreadId = Environment.CurrentManagedThreadId;
        for (int i = 0; i < count; i++)
        {
            Thread.Sleep(20);
            try { Reading?.Invoke(this, 20 + i); }
            catch (Exception error) { LastError = error; }
            Sent++;
        }
    });
}
```

```test
var window = Ui.Open<MainWindow>();
window.Sensor.Start(5);
assert Ui.WaitUntil(() => window.Sensor.Sent == 5)   // every reading was sent
assert window.Sensor.LastError == null   // no handler touched the window from the sensor's thread
assert Ui.WaitUntil(() => Ui.Text(window, "ReadingText") == "24 °C")   // the last reading is shown
assert window.Sensor.ThreadId != Environment.CurrentManagedThreadId   // the readings really came from another thread
```

## async and await: Leave the UI Thread and Come Back

`Dispatcher.Invoke` works, but writing "go to a background thread, then come back" by hand for every slow operation is clumsy. `async`/`await` does it for you. Look again at `Await_Click` in the first window:

```dotnet
private async void Await_Click(object sender, RoutedEventArgs e)
{
    // runs on the UI thread
    await Task.Run(() => SlowWork());   // SlowWork runs on a pool thread; the handler RETURNS here
    // runs on the UI thread again, when SlowWork has finished
    StatusText.Text = "done";           // safe: we're back on the UI thread
}
```

What `await` does, step by step:

1. `Task.Run(...)` starts `SlowWork` on a thread from the **thread pool** (a set of background threads .NET keeps ready) and returns a `Task`, an object representing work that will finish later.
2. `await` sees the task isn't finished, so the handler **returns** to the dispatcher at that point. The UI thread is free: it repaints, ticks the timer, handles other clicks.
3. When the task finishes, the rest of the method (everything after `await`) is put back in the UI thread's queue, and runs there. That's why the output showed thread 2 before and after, and why the line after `await` may touch controls.

The compiler does this by rewriting the `async` method into a small state machine (like `yield return`, level 4). The "come back to the UI thread" part comes from the **synchronization context** WPF installs on the UI thread, which `await` remembers.

Two kinds of slow work, two ways to await them:

- **Computation** (CPU-bound): `await Task.Run(() => Compute())` moves it to the pool.
- **Waiting for something** (I/O-bound): files, network, databases. Use the async version of the API, which doesn't need a thread at all while it waits: `await File.ReadAllTextAsync(path)`, `await httpClient.GetStringAsync(url)`, `await connection.OpenAsync()`.

**`async void`** is only for event handlers like `Click`, whose signature WPF fixes. Everywhere else, an async method returns `Task` (or `Task<T>`), so its caller can await it and see its exceptions; an exception from an `async void` method is thrown straight onto the UI thread and, unhandled, ends the app.

## Challenge: responsive_report

`ReportBuilder.Build()` (read-only) takes almost a second. Make the Generate button's handler responsive:

- when clicked, set `StatusText` to `"Working..."` and disable `GenerateButton` (`IsEnabled = false`), so it can't be clicked twice;
- run `ReportBuilder.Build()` **off the UI thread**;
- when it's done, show its result in `StatusText` and enable the button again.

The tests click the button and check the window *immediately*: if the handler blocks, the click doesn't return until the work is finished.

```challenge wpf file=MainWindow.xaml.cs
using System.Windows;

namespace LessonApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
    }

    private void Generate_Click(object sender, RoutedEventArgs e)
    {
        // TODO
    }
}
```

```challenge wpf file=MainWindow.xaml readonly
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Report" Width="320" Height="160">
    <StackPanel Margin="16">
        <TextBlock x:Name="StatusText" Text="Ready" FontSize="16"/>
        <Button x:Name="GenerateButton" Content="Generate" Click="Generate_Click" Margin="0,12,0,0"/>
    </StackPanel>
</Window>
```

```challenge wpf file=ReportBuilder.cs readonly
namespace LessonApp;

public static class ReportBuilder
{
    // Slow on purpose: stands in for real work.
    public static string Build()
    {
        Thread.Sleep(800);
        return "Report: 42 rows";
    }
}
```

```test
var window = Ui.Open<MainWindow>();
Ui.Click(window, "GenerateButton");
assert Ui.Text(window, "StatusText") == "Working..."   // the click returned while the work was still running
assert Ui.IsEnabled(window, "GenerateButton") == false   // and the button can't be clicked twice
assert Ui.WaitUntil(() => Ui.Text(window, "StatusText") == "Report: 42 rows")   // the result arrives
assert Ui.IsEnabled(window, "GenerateButton") == true   // and the button works again
```

## Progress<T>: Reporting From a Background Thread

Long work should show progress. `IProgress<T>` is the interface for "report how far along I am", and `Progress<T>` is its implementation for UIs: it remembers the thread it was **created** on and runs its callback there, whichever thread calls `Report`. The background code takes an `IProgress<int>` and never knows a window exists.

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Progress" Width="420" Height="200">
    <StackPanel Margin="16">
        <ProgressBar x:Name="Bar" Height="20" Maximum="100"/>
        <TextBlock x:Name="StatusText" Margin="0,8,0,0" Text="Ready"/>
        <Button x:Name="StartButton" Content="Process 50 files" Click="Start_Click" Margin="0,12,0,0"/>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;

namespace LessonApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
    }

    private async void Start_Click(object sender, RoutedEventArgs e)
    {
        StartButton.IsEnabled = false;
        // Progress<T> remembers the thread it was created on (the UI thread) and runs this
        // callback there, whichever thread calls Report.
        var progress = new Progress<int>(percent =>
        {
            Bar.Value = percent;
            StatusText.Text = $"{percent}%";
        });
        int processed = await Task.Run(() => ProcessFiles(50, progress));
        StatusText.Text = $"Done: {processed} files";
        StartButton.IsEnabled = true;
        Console.WriteLine(StatusText.Text);
    }

    // Runs on a background thread, and knows nothing about the window.
    private static int ProcessFiles(int count, IProgress<int> progress)
    {
        for (int i = 1; i <= count; i++)
        {
            Thread.Sleep(40);   // pretend to process a file
            progress.Report(i * 100 / count);
        }
        return count;
    }
}
```

Launch it and click: the bar fills over two seconds while the window stays live, then `Done: 50 files`.

**SE lens:** Keep the background method free of anything WPF: it takes its input and an `IProgress<T>` (and, in level 27, a `CancellationToken`), and returns its result. Then it can be tested and reused, and the threading lives in one obvious place, the `await` in the handler or command.

## The Freeze You Can't Get Out Of: .Result

One mistake turns "a bit slow" into "frozen forever". This handler calls an async method and, instead of awaiting it, asks for its result directly with `.Result` (`.Wait()` and `.GetAwaiter().GetResult()` behave the same):

```dotnet
private void Load_Click(object sender, RoutedEventArgs e)
{
    StatusText.Text = LoadAsync().Result;   // blocks the UI thread until LoadAsync finishes
}

private static async Task<string> LoadAsync()
{
    await Task.Delay(100);   // when this finishes, the rest must run on the UI thread...
    return "loaded";
}
```

Tried on a real window: after the click, the window never responds again, not after 100 ms, not after a minute; even Windows' accessibility interface can no longer reach it. `.Result` blocks the UI thread until `LoadAsync` finishes, and `LoadAsync` can't finish, because the code after its `await` is waiting in the UI thread's queue for the UI thread, which is blocked. Each waits for the other: a **deadlock**.

The rule: **async all the way.** If a method calls something async, it awaits it and becomes async itself, up to the event handler or command at the top. Never block on a task on the UI thread. (Library code adds `.ConfigureAwait(false)` to its awaits, which says "don't come back to the UI thread"; that avoids this deadlock but means the code after it may not touch controls, which is why application code normally doesn't use it.)
