---
series: wpf-mastery
level: 37
title: Capstone 1: A Data-Entry App
lang: csharp
---

# Capstone 1: A Data-Entry App

This capstone builds one complete application, a **contact book**, from the inside out, using what the series has built up. A list of contacts you can search, a form to edit one with validation messages under the fields, Add, Save and Delete with a confirmation, and everything saved to a JSON file in the user's data folder. Each challenge builds one layer: the editor's view model with validation, the store that saves to disk, the screen's view model that ties them together, and finally the window. Each step gives you the previous steps' finished code as read-only files, so you build on a working base, and each challenge's tests check its layer on its own, which is the payoff of the design (level 31). One new tool appears along the way: the toolkit's **`ObservableValidator`**, validation from attributes.

## The Plan

Every layer depends only on the ones below it, and on interfaces rather than concrete classes (levels 4 and 28):

```text
MainWindow.xaml            the view: bindings only, no logic                       (levels 6–25)
   │ DataContext
ContactsViewModel          the screen: list, search, selection, Add/Delete          (levels 14, 18, 26, 29)
   │ creates one per edit             │ uses                  │ uses
ContactEditorViewModel     IContactStore             IDialogService
   one contact's form,        LoadAsync / SaveAsync     Confirm(question)
   validation, Save           │                         │
                              JsonContactStore          a dialog window (level 29),
                              contacts.json in          or a fake in tests
                              AppData (level 33)
Contact                    the data: a record (level 2)
```

The data is a record, `Contact(Guid Id, string Name, string Email, string Phone)`. A `Guid` (globally unique identifier) is a random 128-bit value that is, in practice, never generated twice; `Guid.NewGuid()` makes one, so a new contact has an identity before anything saves it. The interfaces and the fakes used by the tests are in `Support.cs`, the same file in every step.

## ObservableValidator: Validation from Attributes

Level 19 implemented `INotifyDataErrorInfo` by hand. The toolkit's **`ObservableValidator`** base class does it from **validation attributes** (from `System.ComponentModel.DataAnnotations`): `[Required]`, `[EmailAddress]`, `[StringLength(20)]`, `[Range(1, 10)]` and more, each with an optional `ErrorMessage`. Add **`[NotifyDataErrorInfo]`** to an `[ObservableProperty]` field (level 26) and the generated setter validates the new value and raises `ErrorsChanged`. Measured with an editor whose `Name` is `[Required]` and whose `Email` is `[EmailAddress]`, both starting as `""`:

```text
new:                                   HasErrors False
Name = "" (it was already ""):         HasErrors False, no errors
Email = "ada":                         The Email field is not a valid e-mail address.
Email = "":                            1 error
ValidateAllProperties() on a new one:  HasErrors True: The Name field is required. | The Email field is not a valid e-mail address.
[Required(ErrorMessage = "Enter a name.")], Name = "":   Enter a name.
[StringLength(20)], 30 characters:     The field Note must be a string with a maximum length of 20.
```

Three behaviours shape the editor you're about to write:

- **Validation runs when a value *changes*.** Setting `Name` to `""` when it already was `""` didn't run the setter's logic (level 26: the generated setter compares first), so a brand-new blank contact shows no errors. **`ValidateAllProperties()`** validates everything at once; call it when the user tries to save.
- **`[EmailAddress]` rejects an empty string.** An email that's required anyway needs `[Required]` too (for a clearer message on empty); an optional email would need a custom rule.
- **Write your own `ErrorMessage`.** The defaults name the C# property ("The Email field...") and read like a developer wrote them.

## Challenge: contact_editor

Make **`ContactEditorViewModel`** (in `ContactEditorViewModel.cs`) validate, using `ObservableValidator`:

- `Name` is required, message **`Enter a name.`**
- `Email` is required, message **`Enter an email address.`**, and must be an email address, message **`Enter a valid email address.`**
- `Phone` has no rules.
- **`SaveCommand`** can execute only while there are no errors, and its `CanExecute` must update as the errors change.
- **`Save`** validates **all** properties first; only if there are no errors does it raise **`Saved`** with a `Contact` made from the fields, each **trimmed** of surrounding spaces, keeping the original `Id`.

`[NotifyCanExecuteChangedFor(nameof(SaveCommand))]` on a field refreshes the command when the field changes (level 26). `GetErrors(propertyName)` returns a property's errors as `ValidationResult`s, whose `ErrorMessage` is the text.

```challenge console file=ContactEditorViewModel.cs
using System.ComponentModel.DataAnnotations;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace LessonApp;

public partial class ContactEditorViewModel : ObservableValidator
{
    private readonly Guid id;

    public ContactEditorViewModel(Contact contact)
    {
        id = contact.Id;
        name = contact.Name;
        email = contact.Email;
        phone = contact.Phone;
    }

    [ObservableProperty]
    private string name;

    [ObservableProperty]
    private string email;

    [ObservableProperty]
    private string phone;

    public event EventHandler<Contact>? Saved;

    [RelayCommand]
    private void Save()
    {
        // TODO: validate first
        Saved?.Invoke(this, new Contact(id, Name, Email, Phone));
    }
}
```

```challenge console file=Support.cs readonly
namespace LessonApp;

public record Contact(Guid Id, string Name, string Email, string Phone);

public interface IContactStore
{
    Task<List<Contact>> LoadAsync();
    Task SaveAsync(IEnumerable<Contact> contacts);
}

public interface IDialogService
{
    bool Confirm(string question);
}

public class FakeDialogService : IDialogService
{
    public bool Answer { get; set; } = true;
    public List<string> Asked { get; } = new();

    public bool Confirm(string question)
    {
        Asked.Add(question);
        return Answer;
    }
}

public class MemoryContactStore : IContactStore
{
    public List<Contact> Saved { get; private set; } = new()
    {
        new(Guid.Parse("00000000-0000-0000-0000-000000000001"), "Grace Hopper", "grace@navy.example", "555-0101"),
        new(Guid.Parse("00000000-0000-0000-0000-000000000002"), "Ada Lovelace", "ada@engine.example", "555-0102"),
        new(Guid.Parse("00000000-0000-0000-0000-000000000003"), "Linus Torvalds", "linus@kernel.example", ""),
    };

    public int SaveCount { get; private set; }

    public Task<List<Contact>> LoadAsync() => Task.FromResult(Saved.ToList());

    public Task SaveAsync(IEnumerable<Contact> contacts)
    {
        Saved = contacts.ToList();
        SaveCount++;
        return Task.CompletedTask;
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
var id = Guid.NewGuid();
var editor = new ContactEditorViewModel(new Contact(id, "Ada Lovelace", "ada@engine.example", "555-0102"));
assert !editor.HasErrors && editor.SaveCommand.CanExecute(null)   // a valid contact starts valid
var refreshes = 0; editor.SaveCommand.CanExecuteChanged += (_, _) => refreshes++;
editor.Name = "";
assert editor.GetErrors(nameof(ContactEditorViewModel.Name)).Cast<System.ComponentModel.DataAnnotations.ValidationResult>().First().ErrorMessage == "Enter a name." && !editor.SaveCommand.CanExecute(null) && refreshes > 0   // the error, Save disabled, and bound buttons told so
editor.Name = "Ada"; editor.Email = "ada";
assert editor.GetErrors(nameof(ContactEditorViewModel.Email)).Cast<System.ComponentModel.DataAnnotations.ValidationResult>().Any(error => error.ErrorMessage == "Enter a valid email address.")
var saved = new List<Contact>(); var blank = new ContactEditorViewModel(new Contact(Guid.NewGuid(), "", "", "")); blank.Saved += (_, contact) => saved.Add(contact);
blank.SaveCommand.Execute(null);
assert saved.Count == 0 && blank.GetErrors(nameof(ContactEditorViewModel.Name)).Any() && blank.GetErrors(nameof(ContactEditorViewModel.Email)).Cast<System.ComponentModel.DataAnnotations.ValidationResult>().Any(error => error.ErrorMessage == "Enter an email address.")   // saving a blank contact validates everything and doesn't save
var good = new ContactEditorViewModel(new Contact(id, "x", "x@y.example", "")); good.Saved += (_, contact) => saved.Add(contact);
good.Name = "  Ada King  "; good.Email = " ada@king.example "; good.SaveCommand.Execute(null);
assert saved.Count == 1 && saved[0] == new Contact(id, "Ada King", "ada@king.example", "")   // trimmed, same Id
```

## Challenge: contact_store

Write **`JsonContactStore`** (in `JsonContactStore.cs`), the real `IContactStore`, as level 33 taught. Its constructor takes the folder, and it keeps the contacts in **`contacts.json`** there:

- **`SaveAsync(contacts)`** writes them as JSON with **camelCase** names, creating the folder if needed, **through a temporary file**;
- **`LoadAsync()`** returns the saved contacts, or an **empty list** when the file is missing or isn't valid JSON.

`File.ReadAllTextAsync(path)` and `File.WriteAllTextAsync(path, text)` are the asynchronous versions of level 33's methods.

```challenge console file=JsonContactStore.cs
using System.IO;
using System.Text.Json;

namespace LessonApp;

public class JsonContactStore : IContactStore
{
    public JsonContactStore(string folder) { }

    public Task<List<Contact>> LoadAsync() => Task.FromResult(new List<Contact>());

    public Task SaveAsync(IEnumerable<Contact> contacts) => Task.CompletedTask;
}
```

```challenge console file=Support.cs readonly
namespace LessonApp;

public record Contact(Guid Id, string Name, string Email, string Phone);

public interface IContactStore
{
    Task<List<Contact>> LoadAsync();
    Task SaveAsync(IEnumerable<Contact> contacts);
}

public interface IDialogService
{
    bool Confirm(string question);
}

public class FakeDialogService : IDialogService
{
    public bool Answer { get; set; } = true;
    public List<string> Asked { get; } = new();

    public bool Confirm(string question)
    {
        Asked.Add(question);
        return Answer;
    }
}

public class MemoryContactStore : IContactStore
{
    public List<Contact> Saved { get; private set; } = new()
    {
        new(Guid.Parse("00000000-0000-0000-0000-000000000001"), "Grace Hopper", "grace@navy.example", "555-0101"),
        new(Guid.Parse("00000000-0000-0000-0000-000000000002"), "Ada Lovelace", "ada@engine.example", "555-0102"),
        new(Guid.Parse("00000000-0000-0000-0000-000000000003"), "Linus Torvalds", "linus@kernel.example", ""),
    };

    public int SaveCount { get; private set; }

    public Task<List<Contact>> LoadAsync() => Task.FromResult(Saved.ToList());

    public Task SaveAsync(IEnumerable<Contact> contacts)
    {
        Saved = contacts.ToList();
        SaveCount++;
        return Task.CompletedTask;
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
var folder = Path.Combine(Path.GetTempPath(), "contacts-" + Guid.NewGuid().ToString("N"));
var store = new JsonContactStore(folder);
assert store.LoadAsync().GetAwaiter().GetResult().Count == 0   // no file yet: an empty list, not an exception
var people = new List<Contact> { new(Guid.NewGuid(), "Ada Lovelace", "ada@engine.example", "555-0102"), new(Guid.NewGuid(), "Grace Hopper", "grace@navy.example", "") };
store.SaveAsync(people).GetAwaiter().GetResult();
assert File.ReadAllText(Path.Combine(folder, "contacts.json")).Contains("\"name\"") && !File.Exists(Path.Combine(folder, "contacts.json.tmp"))   // camelCase, through a temporary file
assert new JsonContactStore(folder).LoadAsync().GetAwaiter().GetResult().SequenceEqual(people)   // a new store reads them back exactly
File.WriteAllText(Path.Combine(folder, "contacts.json"), "[{\"name\": ");
assert store.LoadAsync().GetAwaiter().GetResult().Count == 0   // a corrupt file: empty, not a crash
```

## Challenge: contacts_screen

Write **`ContactsViewModel`** (in `ContactsViewModel.cs`), the view model of the whole screen. It receives an `IContactStore` and an `IDialogService`, and uses the editor from the first challenge (read-only here):

- **`LoadCommand`** (from an `async Task LoadAsync()`) fills `Contacts` from the store.
- **`ContactsView`** shows `Contacts` **sorted by name**, filtered by **`SearchText`**: a contact matches when its name **or** email contains the text, ignoring case. Changing `SearchText` re-filters immediately (level 18).
- Setting **`SelectedContact`** to a contact sets **`Editor`** to a new `ContactEditorViewModel` for it.
- **`AddCommand`** clears the selection and sets `Editor` to an editor for a new blank contact (a new `Guid`, empty fields).
- When an editor raises **`Saved`**, the saved contact **replaces** the one with the same `Id` in `Contacts`, or is **added** if it's new; then all contacts are saved to the store, and the saved contact becomes `SelectedContact`.
- **`DeleteCommand`** (from an `async Task DeleteAsync()`) can execute only while a contact is selected. It asks **`Delete <Name>?`**; on yes it removes the contact, saves the store, and clears `SelectedContact` and `Editor`.

`partial void OnSearchTextChanged(string value)` and `OnSelectedContactChanged` are the toolkit's change hooks (level 26). `new ListCollectionView(Contacts)` creates the view (level 18).

```challenge wpf file=ContactsViewModel.cs
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Windows.Data;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace LessonApp;

public partial class ContactsViewModel : ObservableObject
{
    private readonly IContactStore store;
    private readonly IDialogService dialogs;

    public ContactsViewModel(IContactStore store, IDialogService dialogs)
    {
        this.store = store;
        this.dialogs = dialogs;
        ContactsView = new ListCollectionView(Contacts);
    }

    public ObservableCollection<Contact> Contacts { get; } = new();
    public ICollectionView ContactsView { get; }

    [ObservableProperty]
    private string searchText = "";

    [ObservableProperty]
    private Contact? selectedContact;

    [ObservableProperty]
    private ContactEditorViewModel? editor;

    [RelayCommand]
    private Task LoadAsync() => Task.CompletedTask;   // TODO

    [RelayCommand]
    private void Add() { }   // TODO

    [RelayCommand]
    private Task DeleteAsync() => Task.CompletedTask;   // TODO
}
```

```challenge wpf file=ContactEditorViewModel.cs readonly
using System.ComponentModel.DataAnnotations;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace LessonApp;

public partial class ContactEditorViewModel : ObservableValidator
{
    private readonly Guid id;

    public ContactEditorViewModel(Contact contact)
    {
        id = contact.Id;
        name = contact.Name;
        email = contact.Email;
        phone = contact.Phone;
    }

    [ObservableProperty]
    [NotifyDataErrorInfo]
    [NotifyCanExecuteChangedFor(nameof(SaveCommand))]
    [Required(ErrorMessage = "Enter a name.")]
    private string name;

    [ObservableProperty]
    [NotifyDataErrorInfo]
    [NotifyCanExecuteChangedFor(nameof(SaveCommand))]
    [Required(ErrorMessage = "Enter an email address.")]
    [EmailAddress(ErrorMessage = "Enter a valid email address.")]
    private string email;

    [ObservableProperty]
    private string phone;

    public event EventHandler<Contact>? Saved;

    private bool CanSave() => !HasErrors;

    [RelayCommand(CanExecute = nameof(CanSave))]
    private void Save()
    {
        ValidateAllProperties();
        SaveCommand.NotifyCanExecuteChanged();
        if (HasErrors) return;
        Saved?.Invoke(this, new Contact(id, Name.Trim(), Email.Trim(), Phone.Trim()));
    }
}
```

```challenge wpf file=Support.cs readonly
namespace LessonApp;

public record Contact(Guid Id, string Name, string Email, string Phone);

public interface IContactStore
{
    Task<List<Contact>> LoadAsync();
    Task SaveAsync(IEnumerable<Contact> contacts);
}

public interface IDialogService
{
    bool Confirm(string question);
}

public class FakeDialogService : IDialogService
{
    public bool Answer { get; set; } = true;
    public List<string> Asked { get; } = new();

    public bool Confirm(string question)
    {
        Asked.Add(question);
        return Answer;
    }
}

public class MemoryContactStore : IContactStore
{
    public List<Contact> Saved { get; private set; } = new()
    {
        new(Guid.Parse("00000000-0000-0000-0000-000000000001"), "Grace Hopper", "grace@navy.example", "555-0101"),
        new(Guid.Parse("00000000-0000-0000-0000-000000000002"), "Ada Lovelace", "ada@engine.example", "555-0102"),
        new(Guid.Parse("00000000-0000-0000-0000-000000000003"), "Linus Torvalds", "linus@kernel.example", ""),
    };

    public int SaveCount { get; private set; }

    public Task<List<Contact>> LoadAsync() => Task.FromResult(Saved.ToList());

    public Task SaveAsync(IEnumerable<Contact> contacts)
    {
        Saved = contacts.ToList();
        SaveCount++;
        return Task.CompletedTask;
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
        Title="Contacts" Width="300" Height="200">
    <TextBlock Text="The window comes in the next challenge." Margin="12"/>
</Window>
```

```challenge wpf file=MainWindow.xaml.cs readonly
using System.Windows;

namespace LessonApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
    }
}
```

```test
var store = new MemoryContactStore(); var dialogs = new FakeDialogService();
var screen = new ContactsViewModel(store, dialogs);
screen.LoadCommand.ExecuteAsync(null).GetAwaiter().GetResult();
assert string.Join(",", screen.ContactsView.Cast<Contact>().Select(c => c.Name)) == "Ada Lovelace,Grace Hopper,Linus Torvalds"   // loaded, sorted by name
screen.SearchText = "KERNEL";
assert string.Join(",", screen.ContactsView.Cast<Contact>().Select(c => c.Name)) == "Linus Torvalds"   // matched by email, ignoring case
screen.SearchText = "";
screen.SelectedContact = screen.Contacts.First(c => c.Name == "Ada Lovelace"); screen.Editor!.Email = "ada@lovelace.example"; screen.Editor.SaveCommand.Execute(null);
assert store.SaveCount == 1 && store.Saved.Any(c => c.Email == "ada@lovelace.example") && screen.Contacts.Count == 3 && screen.SelectedContact!.Email == "ada@lovelace.example"   // replaced, saved, still selected
screen.AddCommand.Execute(null);
assert screen.SelectedContact == null && screen.Editor!.Name == "" && !screen.DeleteCommand.CanExecute(null)   // a blank editor; nothing to delete
screen.Editor.Name = "Margaret Hamilton"; screen.Editor.Email = "margaret@apollo.example"; screen.Editor.SaveCommand.Execute(null);
assert screen.Contacts.Count == 4 && screen.SelectedContact!.Name == "Margaret Hamilton" && store.Saved.Count == 4   // a new contact is added and selected
screen.SelectedContact = screen.Contacts.First(c => c.Name == "Grace Hopper"); dialogs.Answer = false; screen.DeleteCommand.ExecuteAsync(null).GetAwaiter().GetResult(); dialogs.Answer = true; screen.DeleteCommand.ExecuteAsync(null).GetAwaiter().GetResult();
assert dialogs.Asked.SequenceEqual(new[] { "Delete Grace Hopper?", "Delete Grace Hopper?" }) && screen.Contacts.All(c => c.Name != "Grace Hopper") && store.Saved.Count == 3 && screen.SelectedContact == null && screen.Editor == null   // no, then yes
```

## Challenge: contacts_window

Now the window. The view models and the store are finished and read-only; the code-behind creates the screen with an in-memory store and a dialog fake, and loads it. Write **`MainWindow.xaml`**, with **bindings only** (no code-behind), using these names, which the tests use:

- a `TextBox` **`SearchBox`** for `SearchText`, filtering as you type;
- a `ListBox` **`ContactList`** showing `ContactsView`, each row showing the contact's `Name`, with its selection bound to `SelectedContact`;
- `Button`s **`AddButton`** and **`DeleteButton`**, bound to the commands;
- an editing area whose `DataContext` is the `Editor`, with `TextBox`es **`NameBox`**, **`EmailBox`** and **`PhoneBox`** (each updating the editor as you type), `TextBlock`s **`NameError`** and **`EmailError`** under the name and email boxes showing each box's first validation message (level 19), and a `Button` **`SaveButton`** bound to the editor's `SaveCommand`.

Arrange it however you like (level 8): a common layout is the list on the left and the form on the right.

```challenge wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Contacts" Width="640" Height="420">
    <Grid Margin="12">
        <!-- TODO: the list, the search box, the buttons and the form -->
    </Grid>
</Window>
```

```challenge wpf file=MainWindow.xaml.cs readonly
using System.Windows;

namespace LessonApp;

public partial class MainWindow : Window
{
    public MemoryContactStore Store { get; } = new();
    public FakeDialogService Dialogs { get; } = new();
    public ContactsViewModel Screen { get; }

    public MainWindow()
    {
        InitializeComponent();
        Screen = new ContactsViewModel(Store, Dialogs);
        Screen.LoadCommand.Execute(null);
        DataContext = Screen;
    }
}
```

```challenge wpf file=ContactsViewModel.cs readonly
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Windows.Data;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace LessonApp;

public partial class ContactsViewModel : ObservableObject
{
    private readonly IContactStore store;
    private readonly IDialogService dialogs;

    public ContactsViewModel(IContactStore store, IDialogService dialogs)
    {
        this.store = store;
        this.dialogs = dialogs;
        ContactsView = new ListCollectionView(Contacts);
        ContactsView.SortDescriptions.Add(new SortDescription(nameof(Contact.Name), ListSortDirection.Ascending));
        ContactsView.Filter = Matches;
    }

    public ObservableCollection<Contact> Contacts { get; } = new();
    public ICollectionView ContactsView { get; }

    [ObservableProperty]
    private string searchText = "";

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(DeleteCommand))]
    private Contact? selectedContact;

    [ObservableProperty]
    private ContactEditorViewModel? editor;

    partial void OnSearchTextChanged(string value) => ContactsView.Refresh();

    partial void OnSelectedContactChanged(Contact? value)
    {
        if (value != null) Edit(value);
    }

    private bool Matches(object item)
    {
        var contact = (Contact)item;
        return contact.Name.Contains(SearchText, StringComparison.OrdinalIgnoreCase)
            || contact.Email.Contains(SearchText, StringComparison.OrdinalIgnoreCase);
    }

    [RelayCommand]
    private async Task LoadAsync()
    {
        Contacts.Clear();
        foreach (Contact contact in await store.LoadAsync())
            Contacts.Add(contact);
    }

    [RelayCommand]
    private void Add()
    {
        SelectedContact = null;
        Edit(new Contact(Guid.NewGuid(), "", "", ""));
    }

    private bool CanDelete() => SelectedContact != null;

    [RelayCommand(CanExecute = nameof(CanDelete))]
    private async Task DeleteAsync()
    {
        if (SelectedContact is not Contact contact) return;
        if (!dialogs.Confirm($"Delete {contact.Name}?")) return;
        Contacts.Remove(contact);
        SelectedContact = null;
        Editor = null;
        await store.SaveAsync(Contacts);
    }

    private void Edit(Contact contact)
    {
        var contactEditor = new ContactEditorViewModel(contact);
        contactEditor.Saved += async (_, saved) => await OnSavedAsync(saved);
        Editor = contactEditor;
    }

    private async Task OnSavedAsync(Contact saved)
    {
        int index = Contacts.ToList().FindIndex(contact => contact.Id == saved.Id);
        if (index >= 0) Contacts[index] = saved;
        else Contacts.Add(saved);
        await store.SaveAsync(Contacts);
        SelectedContact = saved;
    }
}
```

```challenge wpf file=ContactEditorViewModel.cs readonly
using System.ComponentModel.DataAnnotations;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace LessonApp;

public partial class ContactEditorViewModel : ObservableValidator
{
    private readonly Guid id;

    public ContactEditorViewModel(Contact contact)
    {
        id = contact.Id;
        name = contact.Name;
        email = contact.Email;
        phone = contact.Phone;
    }

    [ObservableProperty]
    [NotifyDataErrorInfo]
    [NotifyCanExecuteChangedFor(nameof(SaveCommand))]
    [Required(ErrorMessage = "Enter a name.")]
    private string name;

    [ObservableProperty]
    [NotifyDataErrorInfo]
    [NotifyCanExecuteChangedFor(nameof(SaveCommand))]
    [Required(ErrorMessage = "Enter an email address.")]
    [EmailAddress(ErrorMessage = "Enter a valid email address.")]
    private string email;

    [ObservableProperty]
    private string phone;

    public event EventHandler<Contact>? Saved;

    private bool CanSave() => !HasErrors;

    [RelayCommand(CanExecute = nameof(CanSave))]
    private void Save()
    {
        ValidateAllProperties();
        SaveCommand.NotifyCanExecuteChanged();
        if (HasErrors) return;
        Saved?.Invoke(this, new Contact(id, Name.Trim(), Email.Trim(), Phone.Trim()));
    }
}
```

```challenge wpf file=Support.cs readonly
namespace LessonApp;

public record Contact(Guid Id, string Name, string Email, string Phone);

public interface IContactStore
{
    Task<List<Contact>> LoadAsync();
    Task SaveAsync(IEnumerable<Contact> contacts);
}

public interface IDialogService
{
    bool Confirm(string question);
}

public class FakeDialogService : IDialogService
{
    public bool Answer { get; set; } = true;
    public List<string> Asked { get; } = new();

    public bool Confirm(string question)
    {
        Asked.Add(question);
        return Answer;
    }
}

public class MemoryContactStore : IContactStore
{
    public List<Contact> Saved { get; private set; } = new()
    {
        new(Guid.Parse("00000000-0000-0000-0000-000000000001"), "Grace Hopper", "grace@navy.example", "555-0101"),
        new(Guid.Parse("00000000-0000-0000-0000-000000000002"), "Ada Lovelace", "ada@engine.example", "555-0102"),
        new(Guid.Parse("00000000-0000-0000-0000-000000000003"), "Linus Torvalds", "linus@kernel.example", ""),
    };

    public int SaveCount { get; private set; }

    public Task<List<Contact>> LoadAsync() => Task.FromResult(Saved.ToList());

    public Task SaveAsync(IEnumerable<Contact> contacts)
    {
        Saved = contacts.ToList();
        SaveCount++;
        return Task.CompletedTask;
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

```test
var window = Ui.Open<MainWindow>();
assert Ui.ItemCount(window, "ContactList") == 3
Ui.Type(window, "SearchBox", "grace");
assert Ui.ItemCount(window, "ContactList") == 1   // the search box filters the list
Ui.Type(window, "SearchBox", ""); Ui.Select(window, "ContactList", 0);
assert Ui.Text(window, "NameBox") == "Ada Lovelace" && Ui.Text(window, "EmailBox") == "ada@engine.example"   // the selected contact is in the form
Ui.Find<System.Windows.Controls.TextBox>(window, "NameBox").Text = ""; Ui.Flush();
assert Ui.Text(window, "NameError") == "Enter a name." && !Ui.IsEnabled(window, "SaveButton")   // validation shows, and Save is disabled
Ui.Type(window, "NameBox", "Ada King"); Ui.Click(window, "SaveButton");
assert window.Store.Saved.Any(c => c.Name == "Ada King") && Ui.Text(window, "NameError") == ""   // saved through the store
Ui.Click(window, "AddButton");
assert Ui.Text(window, "NameBox") == "" && !Ui.IsEnabled(window, "DeleteButton")   // a blank form for a new contact
```

## Putting It Together

The challenges ran each layer with fakes. The real app wires the real pieces in one place, its **composition root** (level 28):

```dotnet
using System.IO;
using System.Windows;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

static class Program
{
    [STAThread]   // a WPF app's Main must run on a single-threaded apartment thread (level 13)
    static void Main()
    {
        var builder = Host.CreateApplicationBuilder();
        string dataFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ContactBook");
        builder.Services.AddSingleton<IContactStore>(new JsonContactStore(dataFolder));
        builder.Services.AddSingleton<IDialogService, WindowDialogService>();
        builder.Services.AddSingleton<ContactsViewModel>();
        builder.Services.AddSingleton<MainWindow>();
        using IHost host = builder.Build();

        var window = host.Services.GetRequiredService<MainWindow>();
        var screen = host.Services.GetRequiredService<ContactsViewModel>();
        window.DataContext = screen;
        window.Loaded += async (_, _) => await screen.LoadCommand.ExecuteAsync(null);
        new Application().Run(window);
    }
}
```

One build detail appears only now. `using System.IO;` at the top of `JsonContactStore.cs` was unnecessary in the console project of its challenge, but a **WPF** project's implicit usings (level 1) leave out `System.IO` (measured: moved into this app without it, every `Path`, `File` and `Directory` failed with CS0103, "The name 'Path' does not exist in the current context"). The likely reason is that WPF has a `Path` of its own, the shape `System.Windows.Shapes.Path`. Files in a WPF project that work with files need the `using`.

Nothing above the composition root knows that contacts live in a JSON file, or that questions are asked in a window. Swapping the JSON store for SQLite (level 34) changes one line here.

Look back at what each part of the app needed:

| Part | Levels |
|---|---|
| `Contact` as a record, `Guid` identities | 2 |
| interfaces for the store and the dialogs | 4, 28, 29 |
| `ObservableValidator`, `[ObservableProperty]`, `[RelayCommand]`, change hooks | 19, 26 |
| sorted, filtered `ListCollectionView` | 18 |
| atomic JSON save in `AppData` | 33 |
| bindings, `UpdateSourceTrigger`, `(Validation.Errors)/ErrorContent` | 14, 15, 19 |
| layout of the window | 8 |
| tests of each layer with fakes | 31 |

**SE lens:** Notice the order the app was built in: data, then rules, then storage, then the screen's logic, and the window **last**. Every layer was finished and tested before anything depended on it, and the window, the part that's slowest to test, ended up containing no logic at all. That order is the practical meaning of MVVM, and it's how to approach any new screen: write the view model and its tests first, then draw the window that binds to it.
