---
series: wpf-mastery
level: 29
title: Navigation and Dialogs
lang: csharp
---

# Navigation and Dialogs

Level 24 showed a window that displays whatever page view model is current. A real app needs more around that: a **Back** button that returns to the previous page *as it was*, pages created with their dependencies (level 28), and questions such as "Delete this order?" asked from a view model. The last is the awkward one. The obvious code, `MessageBox.Show(...)` inside a command, makes the view model depend on a window, and makes it impossible to test, because the code stops until a person clicks. This lesson builds navigation as a small service with a back stack, and dialogs as a service with an interface, so view models only *ask* and the window decides *how*. You'll write the navigator and a delete command that asks first.

## A Navigator with a Back Stack

Navigation is just state: which page is current, and which pages came before it. That fits in a small class with no WPF in it at all:

- **`Current`**: the current page's view model, which the window shows through implicit data templates (level 24);
- **`NavigateTo(page)`**: pushes the current page onto a **stack** (a last-in, first-out collection, `Stack<T>`: `Push` adds on top, `Pop` removes the top) and makes `page` current;
- **`GoBack()`**: pops the previous page and makes it current again: the *same object*, so whatever the user typed there is still there.

```project wpf file=Navigator.cs
using System.ComponentModel;

namespace LessonApp;

public class Navigator : INotifyPropertyChanged
{
    private readonly Stack<object> history = new();
    private object current;

    public Navigator(object startPage) => current = startPage;

    public object Current => current;
    public bool CanGoBack => history.Count > 0;

    public void NavigateTo(object page)
    {
        history.Push(current);
        Show(page);
    }

    public void GoBack()
    {
        if (CanGoBack) Show(history.Pop());
    }

    private void Show(object page)
    {
        current = page;
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Current)));
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(CanGoBack)));
    }

    public event PropertyChangedEventHandler? PropertyChanged;
}
```

```project wpf file=Pages.cs
namespace LessonApp;

public class SearchPage
{
    public string Query { get; set; } = "";
}

public class ResultPage
{
    public ResultPage(string title) => Title = title;
    public string Title { get; }
}
```

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:local="clr-namespace:LessonApp"
        Title="Navigation" Width="340" Height="200">
    <Window.Resources>
        <DataTemplate DataType="{x:Type local:SearchPage}">
            <StackPanel>
                <TextBlock Text="Search"/>
                <TextBox Text="{Binding Query, UpdateSourceTrigger=PropertyChanged}"/>
            </StackPanel>
        </DataTemplate>
        <DataTemplate DataType="{x:Type local:ResultPage}">
            <TextBlock Text="{Binding Title}" FontSize="18"/>
        </DataTemplate>
    </Window.Resources>
    <DockPanel Margin="12">
        <Button DockPanel.Dock="Top" Content="← Back" HorizontalAlignment="Left" Padding="8,2"
                Click="OnBackClick" IsEnabled="{Binding CanGoBack}"/>
        <ContentControl Content="{Binding Current}" Margin="0,12,0,0"/>
    </DockPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;

namespace LessonApp;

public partial class MainWindow : Window
{
    private readonly Navigator navigator;

    public MainWindow()
    {
        InitializeComponent();
        var search = new SearchPage();
        navigator = new Navigator(search);
        DataContext = navigator;

        search.Query = "wpf books";
        Report("start");
        navigator.NavigateTo(new ResultPage("WPF Unleashed"));
        Report("opened a result");
        navigator.GoBack();
        Report("back");
        Console.WriteLine($"the search page kept its query: \"{((SearchPage)navigator.Current).Query}\", same object: {ReferenceEquals(navigator.Current, search)}");
    }

    private void Report(string step) =>
        Console.WriteLine($"{step,-16} Current = {navigator.Current.GetType().Name,-10} CanGoBack = {navigator.CanGoBack}");

    private void OnBackClick(object sender, RoutedEventArgs e) => navigator.GoBack();
}
```

The output:

```text
start            Current = SearchPage CanGoBack = False
opened a result  Current = ResultPage CanGoBack = True
back             Current = SearchPage CanGoBack = False
the search page kept its query: "wpf books", same object: True
```

Going back returned the **same** `SearchPage` object, so its query survived. That's the main design decision in navigation: a back stack of **view models** keeps each page's state for free, which a browser-style "recreate the page" approach loses. The price is memory: every page in the history stays alive, so an app with very deep navigation may cap the history's size.

`CanGoBack` changes whenever `Current` does, so `Show` raises `PropertyChanged` for both. The Back button binds `IsEnabled` to it. With level 26's toolkit, Back would be a `[RelayCommand(CanExecute = nameof(CanGoBack))]` instead, and the button would enable itself through the command.

**Creating pages.** In a real app, `new ResultPage(...)` is replaced by a factory, so pages get their services from the container (level 28):

```dotnet
public void NavigateTo<TPage>() where TPage : notnull => NavigateTo(services.GetRequiredService<TPage>());
```

with each page view model registered as **transient**, so each visit gets a fresh one, while the navigator itself is a **singleton**, one for the app. Data for the new page (an id, a search term) is passed as a constructor argument or to an `Initialize(...)` method after creation.

## Challenge: back_stack

Write **`Navigator`** in `Navigator.cs` (no WPF needed; the read-only window uses it):

- the constructor takes the start page, which becomes **`Current`**;
- **`NavigateTo(object page)`** makes `page` current and remembers the previous page;
- **`GoBack()`** returns to the most recently remembered page (the *same object*), and does nothing when there is none;
- **`CanGoBack`** is `true` while there's a page to go back to;
- **`PropertyChanged`** is raised for `Current` and `CanGoBack` whenever they change.

```challenge wpf file=Navigator.cs
using System.ComponentModel;

namespace LessonApp;

public class Navigator : INotifyPropertyChanged
{
    public Navigator(object startPage) { }

    public object Current => null!;
    public bool CanGoBack => false;

    public void NavigateTo(object page) { }
    public void GoBack() { }

    public event PropertyChangedEventHandler? PropertyChanged;
}
```

```challenge wpf file=MainWindow.xaml readonly
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Pages" Width="300" Height="160">
    <DockPanel Margin="12">
        <Button x:Name="BackButton" DockPanel.Dock="Top" Content="← Back" HorizontalAlignment="Left" Click="OnBackClick" IsEnabled="{Binding CanGoBack}"/>
        <ContentControl x:Name="PageHost" Content="{Binding Current}"/>
    </DockPanel>
</Window>
```

```challenge wpf file=MainWindow.xaml.cs readonly
using System.Windows;

namespace LessonApp;

public partial class MainWindow : Window
{
    public Navigator Navigator { get; } = new("home");

    public MainWindow()
    {
        InitializeComponent();
        DataContext = Navigator;
    }

    private void OnBackClick(object sender, RoutedEventArgs e) => Navigator.GoBack();
}
```

```test
var nav = new Navigator("home");
assert (string)nav.Current == "home" && !nav.CanGoBack   // the start page, with nothing to go back to
nav.GoBack();
assert (string)nav.Current == "home"   // going back with no history does nothing
var details = new object();
nav.NavigateTo("list"); nav.NavigateTo(details); nav.GoBack();
assert (string)nav.Current == "list" && nav.CanGoBack   // one step back, and one more is possible
nav.GoBack();
assert (string)nav.Current == "home" && !nav.CanGoBack
var window = Ui.Open<MainWindow>();
window.Navigator.NavigateTo(details); Ui.Flush();
assert Ui.IsEnabled(window, "BackButton") && Ui.Find<System.Windows.Controls.ContentControl>(window, "PageHost").Content == details   // the window followed, through PropertyChanged
Ui.Click(window, "BackButton");
assert (string)Ui.Find<System.Windows.Controls.ContentControl>(window, "PageHost").Content == "home" && !Ui.IsEnabled(window, "BackButton")
```

## Dialog Windows

A **modal dialog** is a window the user must answer before going back to the rest of the app. Any `Window` becomes one when you open it with **`ShowDialog()`** instead of `Show()`: the call doesn't return until the dialog closes, and it returns the dialog's **`DialogResult`**, a `bool?`. The pieces, measured with a confirmation window:

| The user | `ShowDialog()` returns |
|---|---|
| clicks a button whose handler sets `DialogResult = true` | `True` (setting `DialogResult` also closes the window) |
| clicks the button marked **`IsCancel="True"`**, or presses Escape | `False`, with no code: `IsCancel` does it |
| closes the window any other way (the title bar's ×, or code calling `Close()`) | `False` |

Two more settings complete a dialog. **`IsDefault="True"`** on the confirming button makes Enter press it. **`Owner = mainWindow`** keeps the dialog in front of its owner and centred on it with `WindowStartupLocation="CenterOwner"`. And `DialogResult` only works on a window shown with `ShowDialog()`. On any other window, setting it throws `InvalidOperationException: DialogResult can be set only after Window is created and shown as dialog.` (measured).

```xml
<Window x:Class="LessonApp.ConfirmWindow" ... Title="Confirm" SizeToContent="WidthAndHeight"
        WindowStartupLocation="CenterOwner" ResizeMode="NoResize" ShowInTaskbar="False">
    <StackPanel Margin="16">
        <TextBlock x:Name="Question" Margin="0,0,0,12"/>
        <StackPanel Orientation="Horizontal" HorizontalAlignment="Right">
            <Button Content="Delete" IsDefault="True" Click="OnConfirmClick" Padding="12,4"/>
            <Button Content="Cancel" IsCancel="True" Padding="12,4" Margin="8,0,0,0"/>
        </StackPanel>
    </StackPanel>
</Window>
```

with `private void OnConfirmClick(object sender, RoutedEventArgs e) => DialogResult = true;` in its code-behind.

That `ShowDialog()` waits is the whole point for the user, and the whole problem for your code. The probe used to measure the table above hung, still waiting, until it was killed: a dialog that no person answers stops the code that opened it forever. A view model that calls `ShowDialog()` or `MessageBox.Show(...)` can't be tested, and it also depends on window classes, which MVVM keeps out of view models (level 14).

## Dialogs as a Service

The fix is level 4's "program to an interface" and level 28's dependency injection. The view model asks a question through an **interface**; the app gives it an implementation that shows a real window; tests give it a **fake** that answers instantly:

```dotnet
public interface IDialogService
{
    bool Confirm(string question);
}

// In the app: shows the real ConfirmWindow, owned by the main window.
public class WindowDialogService : IDialogService
{
    public bool Confirm(string question)
    {
        var dialog = new ConfirmWindow(question) { Owner = Application.Current.MainWindow };
        return dialog.ShowDialog() == true;
    }
}

// In tests: answers with whatever the test chose, and remembers what it was asked.
public class FakeDialogService : IDialogService
{
    public bool Answer { get; set; }
    public List<string> Asked { get; } = new();

    public bool Confirm(string question)
    {
        Asked.Add(question);
        return Answer;
    }
}
```

`dialog.ShowDialog() == true` turns the `bool?` into a `bool`: `null` and `false` both mean "not confirmed". The view model receives an `IDialogService` in its constructor and never knows which one it got. In the app, `services.AddSingleton<IDialogService, WindowDialogService>()` (level 28) wires the real one.

**SE lens:** The fake also lets a test check *what was asked*: the exact wording of the question, and that a question was asked at all before something destructive happened. Questions are behaviour; with this design they're testable behaviour. The same shape works for other things a view model needs from the UI layer: picking a file (`IFileDialogService.OpenFile()`), showing a notification, opening a second window.

## Challenge: delete_confirm

Finish **`OrdersViewModel`** in `OrdersViewModel.cs`. It receives an `IDialogService` in its constructor (given, read-only), and has a `[RelayCommand]` method `Delete`, which creates the `DeleteCommand` property (level 26). `Delete` must:

- ask exactly **`Delete order <Number>?`** for the `SelectedOrder` (for order `1042`: `Delete order 1042?`);
- remove the order from `Orders` **only if** the answer is yes, and then set `SelectedOrder` to `null`;
- not be able to run at all (`CanExecute` false, and nothing asked) while no order is selected. Use `[RelayCommand(CanExecute = nameof(CanDelete))]` and refresh the command when the selection changes (level 26's `[NotifyCanExecuteChangedFor]`).

```challenge wpf file=OrdersViewModel.cs
using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace LessonApp;

public partial class OrdersViewModel : ObservableObject
{
    private readonly IDialogService dialogs;

    public OrdersViewModel(IDialogService dialogs) => this.dialogs = dialogs;

    public ObservableCollection<Order> Orders { get; } = new() { new(1041, "Tea"), new(1042, "Coffee"), new(1043, "Cocoa") };

    [ObservableProperty]
    private Order? selectedOrder;

    [RelayCommand]
    private void Delete()
    {
        // TODO
    }
}
```

```challenge wpf file=Dialogs.cs readonly
namespace LessonApp;

public record Order(int Number, string Item);

public interface IDialogService
{
    bool Confirm(string question);
}

public class FakeDialogService : IDialogService
{
    public bool Answer { get; set; }
    public List<string> Asked { get; } = new();

    public bool Confirm(string question)
    {
        Asked.Add(question);
        return Answer;
    }
}
```

```challenge wpf file=LessonApp.csproj readonly
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

```challenge wpf file=MainWindow.xaml readonly
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Orders" Width="300" Height="220">
    <DockPanel Margin="12">
        <Button x:Name="DeleteButton" DockPanel.Dock="Bottom" Content="Delete" Command="{Binding DeleteCommand}" HorizontalAlignment="Left" Margin="0,8,0,0"/>
        <ListBox x:Name="OrderList" ItemsSource="{Binding Orders}" SelectedItem="{Binding SelectedOrder}" DisplayMemberPath="Item"/>
    </DockPanel>
</Window>
```

```challenge wpf file=MainWindow.xaml.cs readonly
using System.Windows;

namespace LessonApp;

public partial class MainWindow : Window
{
    public FakeDialogService Dialogs { get; } = new();

    public MainWindow()
    {
        InitializeComponent();
        DataContext = new OrdersViewModel(Dialogs);
    }
}
```

```test
var dialogs = new FakeDialogService();
var orders = new OrdersViewModel(dialogs);
assert !orders.DeleteCommand.CanExecute(null)   // nothing selected: the command can't run
orders.SelectedOrder = orders.Orders[1];
dialogs.Answer = false;
orders.DeleteCommand.Execute(null);
assert dialogs.Asked.Count == 1 && dialogs.Asked[0] == "Delete order 1042?" && orders.Orders.Count == 3   // asked, answered no, nothing deleted
dialogs.Answer = true;
orders.DeleteCommand.Execute(null);
assert orders.Orders.Count == 2 && orders.Orders.All(order => order.Number != 1042) && orders.SelectedOrder == null   // asked again, answered yes: deleted
assert !orders.DeleteCommand.CanExecute(null) && dialogs.Asked.Count == 2   // the selection is gone, so the command is disabled again
var window = Ui.Open<MainWindow>();
window.Dialogs.Answer = true;
Ui.Select(window, "OrderList", 0);
Ui.Click(window, "DeleteButton");
assert window.Dialogs.Asked.SequenceEqual(new[] { "Delete order 1041?" }) && Ui.ItemCount(window, "OrderList") == 2 && !Ui.IsEnabled(window, "DeleteButton")   // the same through the window
```
