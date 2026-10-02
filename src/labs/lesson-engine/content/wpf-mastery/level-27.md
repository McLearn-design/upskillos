---
series: wpf-mastery
level: 27
title: Async Commands: Busy, Cancel, Progress and Errors
lang: csharp
---

# Async Commands: Busy, Cancel, Progress and Errors

Level 13 made a slow button responsive with `await`. Real apps need four more things from every slow operation: the screen should show it's **busy** (and not let it start twice), the user should be able to **cancel** it, it may report **progress**, and when it **fails** the app should say so instead of crashing. In MVVM all four live in the view model's command, and CommunityToolkit.Mvvm's async commands (level 26) provide most of the machinery. This lesson goes through each, with the toolkit's real behaviour measured, including two defaults that bite: a cancelled command doesn't clean up after itself, and an exception thrown by a command bound to a button ends the app. You'll write a cancellable search and a save command that survives a full disk.

## Busy: IsRunning

A command made from an `async Task` method is an `IAsyncRelayCommand`. While its task runs, `IsRunning` is `true` and `CanExecute` is `false` (so a bound button disables itself), and both change back when it finishes. Because `IsRunning` raises `PropertyChanged`, XAML can bind straight to it: `{Binding SearchCommand.IsRunning}`. This window binds a progress bar's visibility to it, and has a Cancel button and an error line; the next sections explain those. Launch it, search, and try cancelling one search and searching for `error`.

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Search" Width="420" Height="380">
    <Window.Resources>
        <BooleanToVisibilityConverter x:Key="VisibleWhenTrue"/>
    </Window.Resources>
    <Grid Margin="16">
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="*"/>
        </Grid.RowDefinitions>
        <Grid.ColumnDefinitions>
            <ColumnDefinition Width="*"/>
            <ColumnDefinition Width="Auto"/>
            <ColumnDefinition Width="Auto"/>
        </Grid.ColumnDefinitions>
        <TextBox x:Name="QueryBox" Text="{Binding Query, UpdateSourceTrigger=PropertyChanged}"/>
        <Button x:Name="SearchButton" Grid.Column="1" Content="Search" Margin="8,0,0,0" Padding="10,2" Command="{Binding SearchCommand}"/>
        <Button x:Name="CancelButton" Grid.Column="2" Content="Cancel" Margin="8,0,0,0" Padding="10,2" Command="{Binding SearchCancelCommand}"/>
        <ProgressBar Grid.Row="1" Grid.ColumnSpan="3" Height="6" Margin="0,10,0,0" IsIndeterminate="True"
                     Visibility="{Binding SearchCommand.IsRunning, Converter={StaticResource VisibleWhenTrue}}"/>
        <TextBlock x:Name="StatusText" Grid.Row="2" Grid.ColumnSpan="3" Margin="0,8,0,0" Text="{Binding Status}"/>
        <ListBox x:Name="ResultList" Grid.Row="3" Grid.ColumnSpan="3" Margin="0,8,0,0" ItemsSource="{Binding Results}"/>
    </Grid>
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
        DataContext = new SearchViewModel(new SlowCatalog());
    }
}
```

```project wpf file=SearchViewModel.cs
using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace LessonApp;

public partial class SearchViewModel(SlowCatalog catalog) : ObservableObject
{
    [ObservableProperty]
    private string query = "pen";

    [ObservableProperty]
    private string status = "";

    public ObservableCollection<string> Results { get; } = new();

    [RelayCommand(IncludeCancelCommand = true)]
    private async Task SearchAsync(CancellationToken token)
    {
        Results.Clear();
        Status = "Searching...";
        try
        {
            var found = await catalog.FindAsync(Query, token);
            foreach (var item in found) Results.Add(item);
            Status = $"Found {found.Count}";
        }
        catch (OperationCanceledException)
        {
            Status = "Cancelled";
        }
        catch (Exception error)
        {
            Status = $"Search failed: {error.Message}";
        }
    }
}
```

```project wpf file=SlowCatalog.cs
namespace LessonApp;

// Stands in for a database or web service: slow, cancellable, and sometimes failing.
public class SlowCatalog
{
    private static readonly string[] Items = ["pen", "pencil", "pencil case", "paper", "stapler", "staples"];

    public async Task<List<string>> FindAsync(string query, CancellationToken token)
    {
        for (int i = 0; i < 20; i++)
            await Task.Delay(100, token);   // two seconds in steps that can be cancelled
        if (query == "error") throw new InvalidOperationException("the catalog is offline");
        return Items.Where(item => item.Contains(query, StringComparison.OrdinalIgnoreCase)).ToList();
    }
}
```

```project wpf file=LessonApp.csproj
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net8.0-windows</TargetFramework>
    <UseWPF>true</UseWPF>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <EnableDefaultApplicationDefinition>false</EnableDefaultApplicationDefinition>
    <RootNamespace>LessonApp</RootNamespace>
    <AssemblyName>LessonApp</AssemblyName>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="CommunityToolkit.Mvvm" Version="8.4.0" />
  </ItemGroup>

</Project>
```

While a search runs: the bar moves, Search is disabled (its `CanExecute` is false), and Cancel is enabled. `BooleanToVisibilityConverter` turns the `bool` into the `Visibility` the progress bar needs; converters are level 16's subject, and this one is built into WPF.

## Cancel: CancellationToken

Cancellation in .NET is **cooperative**: nothing is ever stopped from outside. Whoever wants to cancel calls `Cancel()` on a `CancellationTokenSource`; the code doing the work is handed the source's `CancellationToken` and checks it, either by passing it on to methods that accept one (`Task.Delay(100, token)`, `httpClient.GetAsync(url, token)`, `ReadAsync(buffer, token)`) or by calling `token.ThrowIfCancellationRequested()` in its own loops. When it sees the request, it throws `OperationCanceledException`, which unwinds the work like any exception.

The toolkit wires this up for you: give the command method a `CancellationToken` parameter and set `IncludeCancelCommand = true`, and it creates the source for each run, passes in its token, and generates a second command, `SearchCancelCommand`, that cancels it (enabled only while the search runs). Measured on a command like this one, cancelled after 120 ms:

```text
commands: SearchCommand: IAsyncRelayCommand, SearchCancelCommand: ICommand
running: True, cancel can run: True
awaiting the cancelled run threw TaskCanceledException
status after cancel: 'Searching...', IsRunning: False, task status: Canceled
```

Read the last line: the command stopped and `IsRunning` went back to `false`, but **`Status` still says "Searching..."**. The toolkit ends a cancelled command quietly; anything your method meant to do afterwards didn't happen. That's why `SearchAsync` above catches `OperationCanceledException` and sets the status itself. (`TaskCanceledException` derives from `OperationCanceledException`, so one `catch` handles both.)

C++20 has the same idea in `std::stop_token`; Python's asyncio cancels a task by raising `CancelledError` at its next `await`, which is closer to automatic, but the cleanup rule is the same: catch it, tidy up, and let it end.

## Challenge: cancellable_search

Write `SearchViewModel` (in the console project; the tests use it directly, no window). It receives an `ISearchService` in its constructor. Give it:

- `Query` and `Status`, both `string` properties starting `""` (use `[ObservableProperty]`);
- `SearchCommand`, from an async method that takes a `CancellationToken`, with a cancel command generated for it (`SearchCancelCommand`);
- the search sets `Status` to `"Found <n>"` using the count returned by `service.SearchAsync(Query, token)` (pass the token through!), or to `"Cancelled"` if it was cancelled.

`FakeSearchService` (read-only) takes about half a second and records the token it was given.

```challenge console file=SearchViewModel.cs
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace LessonApp;

public partial class SearchViewModel : ObservableObject
{
    // TODO
}
```

```challenge console file=SearchService.cs readonly
namespace LessonApp;

public interface ISearchService
{
    Task<int> SearchAsync(string query, CancellationToken token);
}

public class FakeSearchService : ISearchService
{
    public int Calls { get; private set; }
    public CancellationToken LastToken { get; private set; }

    public async Task<int> SearchAsync(string query, CancellationToken token)
    {
        Calls++;
        LastToken = token;
        for (int i = 0; i < 10; i++)
            await Task.Delay(50, token);
        return query.Length;
    }
}
```

```challenge console file=LessonApp.csproj readonly
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <RootNamespace>LessonApp</RootNamespace>
    <AssemblyName>LessonApp</AssemblyName>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="CommunityToolkit.Mvvm" Version="8.4.0" />
  </ItemGroup>

</Project>
```

```test
var service = new FakeSearchService();
var vm = new SearchViewModel(service);
vm.Query = "pen";
var first = vm.SearchCommand.ExecuteAsync(null);
assert vm.SearchCommand.IsRunning == true   // busy while the search runs
first.GetAwaiter().GetResult();
assert vm.Status == "Found 3"
var second = vm.SearchCommand.ExecuteAsync(null);
Thread.Sleep(120);
vm.SearchCancelCommand.Execute(null);
try { second.GetAwaiter().GetResult(); } catch (OperationCanceledException) { }
assert vm.Status == "Cancelled"   // the command tidied up after being cancelled
assert service.LastToken.IsCancellationRequested   // the token was passed to the service
assert vm.SearchCommand.IsRunning == false
```

## Progress From a View Model

Progress works as in level 13, with one subtlety: `Progress<T>` runs its callback on the thread it was *created* on, so create it inside the command method (which starts on the UI thread when a button runs it), not in a background method. The view model then exposes the number as a property:

```dotnet
[ObservableProperty]
private int percent;

[RelayCommand(IncludeCancelCommand = true)]
private async Task ImportAsync(CancellationToken token)
{
    var progress = new Progress<int>(value => Percent = value);   // created on the UI thread
    await Task.Run(() => importer.Import(files, progress, token), token);
}
```

and the view binds `<ProgressBar Value="{Binding Percent}" Maximum="100"/>`. The importer takes `IProgress<int>` and `CancellationToken` and knows nothing about WPF, so it can be tested on its own.

## Errors: Catch Them in the Command

What happens when an async command's method throws? Measured, with a command whose method throws `InvalidOperationException("the disk is full")`:

```text
ExecuteAsync threw InvalidOperationException: the disk is full
ExecutionTask status: Faulted
calling Execute (what a button does)...
Unhandled exception. System.InvalidOperationException: the disk is full
   at LessonApp.SearchViewModel.FailAsync()
   at CommunityToolkit.Mvvm.Input.AsyncRelayCommand.AwaitAndThrowIfFailed(Task executionTask)
```

`await vm.FailCommand.ExecuteAsync(null)` hands the exception to the caller, as you'd expect. But a button doesn't call `ExecuteAsync`; it calls `ICommand.Execute`, which can't return anything, so the toolkit rethrows the exception where nobody can catch it, and **the app ends**. In a WPF app it's thrown on the UI thread, with the same result.

So every async command that can fail catches its exceptions and turns them into state the view shows: an error message property, an `IsError` flag. The search above does that with its last `catch` (search for `error` to see it), and the next challenge has you do it for saving.

**SE lens:** Catch the exceptions you expect and can explain (`IOException`, `HttpRequestException`, a validation error from your service) and say something useful. A last `catch (Exception)` in a command is reasonable at this boundary, because the alternative is the app disappearing, but log it (level 28: `logger.LogError(error, ...)`) so the real cause isn't lost behind a friendly message. Never catch exceptions deep inside services just to hide them; let them reach the command, which knows what the user was trying to do.

## Challenge: safe_save

Write `EditorViewModel`. It receives an `IDocumentStore` in its constructor and has:

- `Text`, a `string` property starting `""`;
- `ErrorMessage`, a `string` property starting `""`, and `HasError`, a computed `bool` that's `true` when `ErrorMessage` isn't empty. `HasError` must announce its changes too;
- `SaveCommand`, from an async method that calls `store.SaveAsync(Text)`. If that throws an `IOException`, set `ErrorMessage` to `"Could not save: <the exception's message>"`; if it succeeds, set `ErrorMessage` back to `""`.

Nothing may escape the command: the tests call `Execute`, as a button does.

```challenge console file=EditorViewModel.cs
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace LessonApp;

public partial class EditorViewModel : ObservableObject
{
    // TODO
}
```

```challenge console file=DocumentStore.cs readonly
namespace LessonApp;

public interface IDocumentStore
{
    Task SaveAsync(string text);
}

public class FlakyStore : IDocumentStore
{
    public bool DiskFull { get; set; }
    public string Saved { get; private set; } = "";

    public async Task SaveAsync(string text)
    {
        await Task.Delay(20);
        if (DiskFull) throw new IOException("the disk is full");
        Saved = text;
    }
}
```

```challenge console file=LessonApp.csproj readonly
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <RootNamespace>LessonApp</RootNamespace>
    <AssemblyName>LessonApp</AssemblyName>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="CommunityToolkit.Mvvm" Version="8.4.0" />
  </ItemGroup>

</Project>
```

```test
var store = new FlakyStore { DiskFull = true };
var vm = new EditorViewModel(store);
var changed = new List<string>();
vm.PropertyChanged += (_, e) => changed.Add(e.PropertyName!);
vm.Text = "Dear diary";
vm.SaveCommand.Execute(null);
Thread.Sleep(300);
assert vm.ErrorMessage == "Could not save: the disk is full"   // shown, not thrown
assert vm.HasError == true && changed.Contains("HasError")   // and announced
store.DiskFull = false;
vm.SaveCommand.Execute(null);
Thread.Sleep(300);
assert store.Saved == "Dear diary"
assert vm.ErrorMessage == "" && vm.HasError == false   // the error clears once saving works
```
