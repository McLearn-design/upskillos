---
series: wpf-mastery
level: 26
title: MVVM Done Properly: CommunityToolkit.Mvvm
lang: csharp
---

# MVVM Done Properly: CommunityToolkit.Mvvm

By now a view model property is a field, a getter, a setter that compares, assigns and raises `PropertyChanged`, and maybe a command refresh; a command is a `RelayCommand` field, a constructor line and a `CanExecute` method. It's correct, and it's the same twenty lines over and over. Microsoft's **CommunityToolkit.Mvvm** package removes the repetition with attributes: you write `[ObservableProperty] private int count;` and `[RelayCommand] private void Increment()`, and a **source generator** writes the property and the command for you, at compile time, as ordinary C# you can open and read. It's in most WPF code written today, and in most current tutorials, so this lesson takes it apart: what each attribute generates (shown, from the real build), the rules it depends on, the mistakes that silently break it, and when to reach for each feature. You'll rewrite a hand-made view model with it and build a sign-up form's view model from attributes alone.

It assumes `INotifyPropertyChanged` and commands (level 14), the `ObservableObject`/`SetProperty` base class (level 17), attributes and `partial` (levels 2 and 7) and packages (level 3).

## [ObservableProperty]: a Field Becomes a Property

The package's `ObservableObject` is the same idea as level 17's base class. On top of it, `[ObservableProperty]` on a private field generates the public property for that field. This console program shows what the generated property does when it changes:

```project console file=LessonApp.csproj
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

```project console file=CounterViewModel.cs
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace LessonApp;

public partial class CounterViewModel : ObservableObject
{
    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(ResetCommand))]
    private int count;

    [RelayCommand]
    private void Increment() => Count++;

    [RelayCommand(CanExecute = nameof(CanReset))]
    private void Reset() => Count = 0;

    private bool CanReset() => Count > 0;

    partial void OnCountChanged(int value) => Console.WriteLine($"  OnCountChanged({value})");
}
```

```project console file=Program.cs
using LessonApp;

var counter = new CounterViewModel();
counter.PropertyChanged += (_, e) => Console.WriteLine($"PropertyChanged: {e.PropertyName} = {counter.Count}");
counter.ResetCommand.CanExecuteChanged += (_, _) => Console.WriteLine($"ResetCommand can run: {counter.ResetCommand.CanExecute(null)}");

counter.IncrementCommand.Execute(null);
counter.IncrementCommand.Execute(null);
counter.ResetCommand.Execute(null);
Console.WriteLine($"IncrementCommand is a {counter.IncrementCommand.GetType().Name}");
```

There's no `Count` property and no `IncrementCommand` anywhere in that code, yet `Program.cs` uses both. Press **{ } Generated code** and open `generated/…/ObservablePropertyGenerator/LessonApp.CounterViewModel.g.cs`. Here is the heart of it, as the toolkit wrote it:

```dotnet
partial class CounterViewModel
{
    public int Count
    {
        get => count;
        set
        {
            if (!EqualityComparer<int>.Default.Equals(count, value))
            {
                OnCountChanging(value);
                OnPropertyChanging(...Count);
                count = value;
                OnCountChanged(value);
                OnPropertyChanged(...Count);
                ResetCommand.NotifyCanExecuteChanged();
            }
        }
    }

    partial void OnCountChanging(int value);
    partial void OnCountChanged(int value);
}
```

That's level 17's `SetProperty`, written out, plus three extras you asked for or can use:

- **The name** comes from the field: `count` or `_count` becomes `Count`.
- **`[NotifyCanExecuteChangedFor(nameof(ResetCommand))]`** on the field added the last line: every change to `Count` makes the Reset button re-check `CanReset`. The output shows `ResetCommand can run: False` after the reset.
- **`OnCountChanging` / `OnCountChanged`** are **partial methods**: a declaration the generator writes, and a body you may write (as `CounterViewModel.cs` does) to react to the change. If you don't write one, the compiler removes the call entirely, so the hook costs nothing unless used. The output shows `OnCountChanged` runs *before* `PropertyChanged` is raised.

How this is possible at all: the class is `partial` (level 7), split across files, and a **source generator** is a plugin to the C# compiler that the package adds. During the build it reads the attributes (level 2) and adds more C# files to the same compilation. Nothing happens at run time; there's no reflection and no magic, only code you didn't type.

Two mistakes to try, because both look fine and aren't:

- **Remove `partial`** from the class. The build fails with **CS0260**, "Missing partial modifier on declaration of type 'CounterViewModel'; another partial declaration of this type exists": the generator's file adds to the class, which only works if every part is marked `partial`.
- **Write to the field instead of the property.** Add a method `public void Bump() => count = 99;`. It compiles, with warning **MVVMTK0034**, "The field … is annotated with [ObservableProperty] and should not be directly referenced (use the generated property instead)", and it really does skip everything: no `PropertyChanged`, so a bound label never updates. Inside the view model, always use `Count`, never `count`.

You'll also see a newer form, `[ObservableProperty] public partial int Count { get; set; }` on a **partial property**. With toolkit 8.4 that needs `<LangVersion>preview</LangVersion>` in the project file, and without it the property silently isn't generated (CS9248, "Partial property … must have an implementation part"), so these lessons use the field form, which works on every .NET version.

## [RelayCommand]: a Method Becomes a Command

`[RelayCommand]` on a method generates a command property named after it plus `Command`: `Increment()` becomes `IncrementCommand`. Its generated file (`RelayCommandGenerator/LessonApp.CounterViewModel.Increment.g.cs`) is a few lines:

```dotnet
private RelayCommand? incrementCommand;
public IRelayCommand IncrementCommand => incrementCommand ??= new RelayCommand(new Action(Increment));
```

The command is created the first time it's asked for (`??=`, level 2), then reused. The options:

| You write | You get |
|---|---|
| `[RelayCommand] private void Save()` | `SaveCommand`, an `IRelayCommand` |
| `[RelayCommand] private void Delete(Product product)` | `DeleteCommand`, an `IRelayCommand<Product>`: the button's `CommandParameter` is passed in |
| `[RelayCommand(CanExecute = nameof(CanSave))]` | the command asks `CanSave()` (or a `bool` property named `CanSave`); re-checked whenever something calls `SaveCommand.NotifyCanExecuteChanged()`, which `[NotifyCanExecuteChangedFor]` on the relevant fields does for you |
| `[RelayCommand] private async Task LoadAsync()` | `LoadCommand` (the `Async` suffix is dropped), an `IAsyncRelayCommand` |

The async case does more than it looks. While the task runs, `LoadCommand.IsRunning` is `true` and `CanExecute` is `false`, so a button bound to it greys out and can't start a second load. Measured on a command that waits 300 ms: `while running: IsRunning=True, CanExecute=False`, then `IsRunning=False` once it finishes. That's the busy-state handling level 27 builds properly, provided by one attribute.

**SE lens:** Commands are where a view model's behaviour lives, and making them methods keeps them testable: a test calls `vm.SaveCommand.Execute(null)` (or `await vm.LoadCommand.ExecuteAsync(null)`) and checks the result, with no window. Keep the `CanExecute` rule next to the method, and list every field it depends on with `[NotifyCanExecuteChangedFor]`. Forgetting one is the commonest toolkit bug: the button stays disabled (or enabled) because nothing told it to check again.

## Challenge: toolkit_rewrite

Here's level 14's volume control, written by hand. Rewrite it in `VolumeViewModel.cs` with the toolkit, using **`[ObservableProperty]`** for the volume and **`[RelayCommand]`** for the two commands, with the same behaviour:

- `Volume` starts at 5;
- `VolumeUpCommand` adds 1, and can only run while the volume is below 10;
- `VolumeDownCommand` subtracts 1, and can only run while it's above 0;
- both commands re-check whether they can run every time the volume changes.

The hand-written version, for reference:

```dotnet
public class VolumeViewModel : INotifyPropertyChanged
{
    private int volume = 5;
    public VolumeViewModel()
    {
        VolumeUpCommand = new RelayCommand(() => Volume++, () => Volume < 10);
        VolumeDownCommand = new RelayCommand(() => Volume--, () => Volume > 0);
    }
    public int Volume
    {
        get => volume;
        private set
        {
            volume = value;
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Volume)));
            VolumeUpCommand.RaiseCanExecuteChanged();
            VolumeDownCommand.RaiseCanExecuteChanged();
        }
    }
    public RelayCommand VolumeUpCommand { get; }
    public RelayCommand VolumeDownCommand { get; }
    public event PropertyChangedEventHandler? PropertyChanged;
}
```

```challenge console file=VolumeViewModel.cs
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace LessonApp;

public partial class VolumeViewModel : ObservableObject
{
    // TODO
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
var vm = new VolumeViewModel();
var changes = new List<string>();
vm.PropertyChanged += (_, e) => changes.Add(e.PropertyName!);
assert vm.Volume == 5
for (int i = 0; i < 5; i++) vm.VolumeUpCommand.Execute(null);
assert vm.Volume == 10 && vm.VolumeUpCommand.CanExecute(null) == false   // can't go above 10
assert changes.Count(name => name == "Volume") == 5   // every change was announced
vm.VolumeDownCommand.Execute(null);
assert vm.VolumeUpCommand.CanExecute(null) == true   // re-checked after the change
assert typeof(VolumeViewModel).GetFields(System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance).Any(f => f.IsDefined(typeof(CommunityToolkit.Mvvm.ComponentModel.ObservablePropertyAttribute), false))   // written with [ObservableProperty]
```

## [NotifyPropertyChangedFor]: Properties That Depend on Others

A computed property such as `public string FullName => $"{FirstName} {LastName}";` has no setter, so nothing ever raises `PropertyChanged` for it, and a label bound to `FullName` would never update. `[NotifyPropertyChangedFor(nameof(FullName))]` on the fields it depends on makes their generated setters raise `PropertyChanged` for `FullName` too:

```dotnet
public partial class PersonViewModel : ObservableObject
{
    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(FullName))]
    private string firstName = "";

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(FullName))]
    private string lastName = "";

    public string FullName => $"{FirstName} {LastName}".Trim();
}
```

The three `Notify…For` attributes cover the three kinds of dependency: `[NotifyPropertyChangedFor]` (another property's value depends on this one), `[NotifyCanExecuteChangedFor]` (a command's `CanExecute` depends on it), and `[NotifyDataErrorInfo]` (validation, level 19).

## Challenge: signup_form

Write a sign-up form's view model entirely with attributes. `SignupViewModel` has:

- `FirstName`, `LastName` and `Email`, all `string` properties starting `""`;
- `FullName`, computed as first and last name with a space between, trimmed; it must announce its change whenever either name changes;
- `Message`, a `string` property starting `""`;
- `SignUpCommand`, which sets `Message` to `"Welcome, <FullName>!"`. It can only run when both names are non-empty and `Email` contains `@`, and it must re-check that whenever any of the three changes.

```challenge console file=SignupViewModel.cs
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace LessonApp;

public partial class SignupViewModel : ObservableObject
{
    // TODO
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
var vm = new SignupViewModel();
var changed = new List<string>();
vm.PropertyChanged += (_, e) => changed.Add(e.PropertyName!);
vm.FirstName = "Ada";
assert changed.Contains("FullName")   // FullName announced when FirstName changed
vm.LastName = "Lovelace";
assert vm.FullName == "Ada Lovelace"
assert vm.SignUpCommand.CanExecute(null) == false   // no email yet
vm.Email = "ada@example.com";
assert vm.SignUpCommand.CanExecute(null) == true   // re-checked when Email changed
vm.SignUpCommand.Execute(null);
assert vm.Message == "Welcome, Ada Lovelace!"
vm.LastName = "";
assert vm.SignUpCommand.CanExecute(null) == false   // and when LastName changed
```

## The Toolkit in a Window

Nothing about the window changes: bindings don't know or care that a property was generated. This is the counter again, as a WPF app, with the toolkit view model. Launch it and click.

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Toolkit counter" Width="300" Height="180">
    <StackPanel Margin="16">
        <TextBlock x:Name="CountText" Text="{Binding Count}" FontSize="32"/>
        <StackPanel Orientation="Horizontal" Margin="0,12,0,0">
            <Button x:Name="IncrementButton" Content="+1" Width="70" Command="{Binding IncrementCommand}"/>
            <Button x:Name="ResetButton" Content="Reset" Width="70" Margin="8,0,0,0" Command="{Binding ResetCommand}"/>
        </StackPanel>
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
        DataContext = new CounterViewModel();
    }
}
```

```project wpf file=CounterViewModel.cs
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace LessonApp;

public partial class CounterViewModel : ObservableObject
{
    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(ResetCommand))]
    private int count;

    [RelayCommand]
    private void Increment() => Count++;

    [RelayCommand(CanExecute = nameof(CanReset))]
    private void Reset() => Count = 0;

    private bool CanReset() => Count > 0;
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

The Reset button starts disabled, enables after the first click on +1, and disables again after a reset: `CanReset`, re-checked by `[NotifyCanExecuteChangedFor]`, with no code in the window.

**SE lens:** The toolkit is a convenience, not an architecture. Everything it generates is what you wrote by hand in levels 14 and 17, so when something doesn't update, debug it the same way: open the generated file and check that the setter you expect is there and that you're calling the property, not the field. Keep view models free of `System.Windows` types (no `Visibility`, no `Brush`, no `MessageBox`), so they stay plain classes you can test, which is what the toolkit's attributes were designed to make easy.
