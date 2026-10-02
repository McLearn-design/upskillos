---
series: wpf-mastery
level: 19
title: Validation
lang: csharp
---

# Validation

In level 17, letters typed into a price box gave it a red outline and nothing else: the user knew something was wrong but not what. A real form says what's wrong, next to the field, as soon as it's wrong, and won't save until it's fixed. WPF checks input at three points: when the text is **converted** to the property's type, in **validation rules** attached to a binding, and in the **view model** itself through `INotifyDataErrorInfo`. All three report the same way, through the attached properties `Validation.HasError` and `Validation.Errors`. This lesson shows each one, how to display the message (and one popular way that fills the trace with errors), why an exception in a setter is silently ignored, and how a view model keeps its own list of errors. You'll write a rule for colour codes and a sign-up form that validates itself.

## Three Places Input Can Be Rejected

When a two-way binding sends a value from a control to its source (level 15), three things can stop it:

| Where | What fails | Example message |
|---|---|---|
| **conversion** | the text can't become the property's type | `Value 'abc' could not be converted.` |
| a **`ValidationRule`** on the binding | your rule rejects the raw text | `Enter a whole number.` |
| the **source object**, through `INotifyDataErrorInfo` | your view model reports an error for the property | `An email address needs an @.` |

Whichever it is, the control gets the same two attached properties (level 11): **`Validation.HasError`** (`true` while there's an error) and **`Validation.Errors`**, a read-only collection of `ValidationError` objects whose `ErrorContent` is the message. And the control gets its red outline, which is drawn in the window's **adorner layer** (level 9): a layer on top of everything, so the outline doesn't change the control's size or layout.

This window shows the first kind, the one level 17 left unexplained:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Conversion errors" Width="300" Height="120">
    <StackPanel Margin="12">
        <TextBox x:Name="PriceBox" Text="{Binding Price}"/>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;

namespace LessonApp;

public class Product
{
    public decimal Price { get; set; } = 9.99m;
}

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        var product = new Product();
        DataContext = product;
        Loaded += (_, _) =>
        {
            Enter(PriceBox, "abc");
            Console.WriteLine($"typed 'abc':  Price = {product.Price}, HasError = {Validation.GetHasError(PriceBox)}");
            Console.WriteLine($"  message: {Validation.GetErrors(PriceBox)[0].ErrorContent}");
            Console.WriteLine($"  adorners drawn over the box: {AdornerLayer.GetAdornerLayer(PriceBox)!.GetAdorners(PriceBox)!.Length}");
            Enter(PriceBox, "12.5");
            Console.WriteLine($"typed '12.5': Price = {product.Price}, HasError = {Validation.GetHasError(PriceBox)}");
        };
    }

    // What typing and then leaving the box does: set the text, then send it to the source.
    private static void Enter(TextBox box, string text)
    {
        box.Text = text;
        box.GetBindingExpression(TextBox.TextProperty).UpdateSource();
    }
}
```

`Validation.GetHasError(box)` and `Validation.GetErrors(box)` are the attached properties' `Get` methods. The output:

```text
typed 'abc':  Price = 9.99, HasError = True
  message: Value 'abc' could not be converted.
  adorners drawn over the box: 1
typed '12.5': Price = 12.5, HasError = False
```

The bad text never reached `Price`, which kept `9.99`, and the error cleared itself as soon as valid text was sent. The one adorner is the red outline.

## Showing the Message

The outline says *that* something's wrong. To say *what*, bind a `TextBlock` (or a tooltip) to the control's errors. There's a well-known way to write this binding that works and fills your trace with errors:

```text
{Binding (Validation.Errors)[0].ErrorContent, ElementName=PriceBox}    the common way: index 0
{Binding (Validation.Errors)/ErrorContent, ElementName=PriceBox}       the better way: the current item
```

Both show the first error's message. But while there's **no** error, `[0]` asks an empty collection for its first item, and every time the binding re-evaluates, the trace gets (measured):

```text
System.Windows.Data Error: 17 : Cannot get 'Item[]' value (type 'ValidationError') from '(Validation.Errors)' (type 'ReadOnlyObservableCollection`1'). ... ArgumentOutOfRangeException: Specified argument was out of the range of valid values. (Parameter 'index')
```

The `/` in a path means "the **current item** of this collection" (the item a collection view, level 18, considers current, which is the first), and for an empty collection it's simply nothing, without an error. `(Validation.Errors)` is in parentheses because it's an attached property (level 15).

A common layout puts the message in small red text under the field, and the same message in a tooltip on the box itself, using a style with a **trigger** (level 21) on `Validation.HasError`:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Showing errors" Width="320" Height="150">
    <Window.Resources>
        <Style TargetType="TextBox">
            <Style.Triggers>
                <Trigger Property="Validation.HasError" Value="True">
                    <Setter Property="ToolTip" Value="{Binding (Validation.Errors)/ErrorContent, RelativeSource={RelativeSource Self}}"/>
                </Trigger>
            </Style.Triggers>
        </Style>
    </Window.Resources>
    <StackPanel Margin="12">
        <TextBox x:Name="QuantityBox" Text="{Binding Quantity}"/>
        <TextBlock x:Name="QuantityError" Foreground="Firebrick" FontSize="11"
                   Text="{Binding (Validation.Errors)/ErrorContent, ElementName=QuantityBox}"/>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;
using System.Windows.Controls;

namespace LessonApp;

public class OrderLine
{
    public int Quantity { get; set; } = 1;
}

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        DataContext = new OrderLine();
        Loaded += (_, _) =>
        {
            Console.WriteLine($"valid:   message '{QuantityError.Text}', tooltip '{QuantityBox.ToolTip}'");
            QuantityBox.Text = "two";
            QuantityBox.GetBindingExpression(TextBox.TextProperty).UpdateSource();
            Console.WriteLine($"invalid: message '{QuantityError.Text}', tooltip '{QuantityBox.ToolTip}'");
        };
    }
}
```

The output:

```text
valid:   message '', tooltip ''
invalid: message 'Value 'two' could not be converted.', tooltip 'Value 'two' could not be converted.'
```

Launch it, type letters and press Tab: the message appears under the box, and hovering the box shows it too. The red outline itself comes from the `Validation.ErrorTemplate` attached property, a `ControlTemplate` (level 23) drawn in the adorner layer around an `AdornedElementPlaceholder`; replacing it changes how every error looks.

## ValidationRule: Checking the Raw Text

A **`ValidationRule`** is a class you attach to a binding to check the value on its way to the source. You derive from `ValidationRule` and override one method:

```dotnet
public override ValidationResult Validate(object value, CultureInfo cultureInfo)
```

It returns `ValidationResult.ValidResult` to accept the value, or `new ValidationResult(false, "message")` to reject it with that message. By default a rule runs **before conversion**, so `value` is the raw text from the box: that lets a rule give a better message than "could not be converted". Rules can have properties, set in XAML, which makes them reusable:

```project wpf file=RangeRule.cs
using System.Globalization;
using System.Windows.Controls;

namespace LessonApp;

public class RangeRule : ValidationRule
{
    public int Min { get; set; }
    public int Max { get; set; }

    public override ValidationResult Validate(object value, CultureInfo cultureInfo)
    {
        Console.WriteLine($"   RangeRule got a {value.GetType().Name}: '{value}'");
        if (!int.TryParse(value as string, out int number))
            return new ValidationResult(false, "Enter a whole number.");
        if (number < Min || number > Max)
            return new ValidationResult(false, $"Must be between {Min} and {Max}.");
        return ValidationResult.ValidResult;
    }
}
```

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:local="clr-namespace:LessonApp"
        Title="Validation rules" Width="300" Height="120">
    <StackPanel Margin="12">
        <TextBox x:Name="AgeBox">
            <TextBox.Text>
                <Binding Path="Age">
                    <Binding.ValidationRules>
                        <local:RangeRule Min="18" Max="120"/>
                    </Binding.ValidationRules>
                </Binding>
            </TextBox.Text>
        </TextBox>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;
using System.Windows.Controls;

namespace LessonApp;

public class Member
{
    public int Age { get; set; } = 30;
}

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        var member = new Member();
        DataContext = member;
        Loaded += (_, _) =>
        {
            foreach (string typed in new[] { "abc", "15", "40" })
            {
                AgeBox.Text = typed;
                AgeBox.GetBindingExpression(TextBox.TextProperty).UpdateSource();
                string message = Validation.GetHasError(AgeBox) ? (string)Validation.GetErrors(AgeBox)[0].ErrorContent : "(valid)";
                Console.WriteLine($"typed '{typed}': Age = {member.Age}, {message}");
            }
        };
    }
}
```

A binding with rules has to be written in **element syntax**, `<Binding Path="Age">` inside `<TextBox.Text>`, because `Binding.ValidationRules` is a collection and can't be set in the one-line `{Binding ...}` form. The output:

```text
   RangeRule got a String: 'abc'
typed 'abc': Age = 30, Enter a whole number.
   RangeRule got a String: '15'
typed '15': Age = 30, Must be between 18 and 120.
   RangeRule got a String: '40'
typed '40': Age = 40, (valid)
```

The rule saw the raw `String` each time, and `Age` only changed when the rule accepted the text.

## Challenge: color_rule

A theme editor stores colours as `#RRGGBB` codes. Write **`HexColorRule`** in `HexColorRule.cs`, a `ValidationRule` for the raw text typed into the read-only window's **`AccentBox`**:

- text that doesn't start with `#` → invalid, with the message **`Start with #.`**
- text that starts with `#` but isn't followed by exactly **6** hexadecimal digits (`0`–`9`, `a`–`f`, `A`–`F`) → invalid, with the message **`Use 6 hex digits after #.`**
- otherwise valid.

`text.StartsWith('#')` tests the first character. `Uri.IsHexDigit(c)` is `true` for a hexadecimal digit. `text[1..]` is the text from index 1 to the end (a C# range).

```challenge wpf file=HexColorRule.cs
using System.Globalization;
using System.Windows.Controls;

namespace LessonApp;

public class HexColorRule : ValidationRule
{
    public override ValidationResult Validate(object value, CultureInfo cultureInfo)
    {
        // TODO
        return ValidationResult.ValidResult;
    }
}
```

```challenge wpf file=MainWindow.xaml readonly
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:local="clr-namespace:LessonApp"
        Title="Theme" Width="300" Height="140">
    <StackPanel Margin="12">
        <TextBox x:Name="AccentBox">
            <TextBox.Text>
                <Binding Path="Accent">
                    <Binding.ValidationRules>
                        <local:HexColorRule/>
                    </Binding.ValidationRules>
                </Binding>
            </TextBox.Text>
        </TextBox>
        <TextBlock x:Name="AccentError" Foreground="Firebrick" Text="{Binding (Validation.Errors)/ErrorContent, ElementName=AccentBox}"/>
    </StackPanel>
</Window>
```

```challenge wpf file=MainWindow.xaml.cs readonly
using System.Windows;

namespace LessonApp;

public class Theme
{
    public string Accent { get; set; } = "#2563EB";
}

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        DataContext = new Theme();
    }
}
```

```test
var window = Ui.Open<MainWindow>();
var theme = (Theme)window.DataContext;
Ui.Type(window, "AccentBox", "2563EB");
assert Ui.Text(window, "AccentError") == "Start with #." && theme.Accent == "#2563EB"   // rejected, and the theme keeps its colour
Ui.Type(window, "AccentBox", "#25");
assert Ui.Text(window, "AccentError") == "Use 6 hex digits after #."   // too short
Ui.Type(window, "AccentBox", "#2563EZ");
assert Ui.Text(window, "AccentError") == "Use 6 hex digits after #."   // Z is not a hex digit
Ui.Type(window, "AccentBox", "#dc2626");
assert Ui.Text(window, "AccentError") == "" && theme.Accent == "#dc2626"   // valid, lower case too, and saved
Ui.Type(window, "AccentBox", "#1234567");
assert Ui.Text(window, "AccentError") == "Use 6 hex digits after #." && theme.Accent == "#dc2626"   // too long
```

## INotifyDataErrorInfo: Validation in the View Model

Conversion errors and rules live in the view, on the binding. Rules about the *data*, such as "an email needs an @" or "the confirmation must match the password", belong in the view model, where tests can check them without a window and where they also apply when code sets a value. A view model reports its errors by implementing **`INotifyDataErrorInfo`** (in `System.ComponentModel`):

```dotnet
public interface INotifyDataErrorInfo
{
    bool HasErrors { get; }                                              // any error at all?
    IEnumerable GetErrors(string? propertyName);                         // the errors for one property
    event EventHandler<DataErrorsChangedEventArgs>? ErrorsChanged;       // "the errors for this property changed"
}
```

A binding whose source implements it listens to `ErrorsChanged` and, when it's raised for the bound property, calls `GetErrors` and shows the result on the control, with no extra setting in the XAML (`ValidatesOnNotifyDataErrors` defaults to `true`). The usual implementation keeps a dictionary from property name to a list of messages:

```project wpf file=Account.cs
using System.Collections;
using System.ComponentModel;

namespace LessonApp;

public class Account : INotifyDataErrorInfo
{
    private readonly Dictionary<string, List<string>> errors = new();
    private string email = "";

    public string Email
    {
        get => email;
        set
        {
            email = value;
            SetErrors(nameof(Email), value.Contains('@') ? new() : new() { "An email address needs an @." });
        }
    }

    public bool HasErrors => errors.Count > 0;

    public IEnumerable GetErrors(string? propertyName) =>
        propertyName != null && errors.TryGetValue(propertyName, out var list) ? list : Array.Empty<string>();

    public event EventHandler<DataErrorsChangedEventArgs>? ErrorsChanged;

    private void SetErrors(string propertyName, List<string> messages)
    {
        if (messages.Count == 0) errors.Remove(propertyName);
        else errors[propertyName] = messages;
        ErrorsChanged?.Invoke(this, new DataErrorsChangedEventArgs(propertyName));
    }
}
```

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="View model validation" Width="300" Height="120">
    <StackPanel Margin="12">
        <TextBox x:Name="EmailBox" Text="{Binding Email}"/>
        <TextBlock x:Name="EmailError" Foreground="Firebrick" Text="{Binding (Validation.Errors)/ErrorContent, ElementName=EmailBox}"/>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;
using System.Windows.Controls;

namespace LessonApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        var account = new Account();
        DataContext = account;
        Loaded += (_, _) =>
        {
            EmailBox.Text = "ada";
            EmailBox.GetBindingExpression(TextBox.TextProperty).UpdateSource();
            Console.WriteLine($"typed 'ada':    Email = '{account.Email}', HasErrors = {account.HasErrors}, shown: '{EmailError.Text}'");
            account.Email = "ada@example.com";
            Console.WriteLine($"set from code:  Email = '{account.Email}', HasErrors = {account.HasErrors}, shown: '{EmailError.Text}'");
        };
    }
}
```

`errors.TryGetValue(key, out var list)` returns whether the dictionary has the key, and puts its value in `list`. The output:

```text
typed 'ada':    Email = 'ada', HasErrors = True, shown: 'An email address needs an @.'
set from code:  Email = 'ada@example.com', HasErrors = False, shown: ''
```

Note the difference from the first two layers: the invalid `ada` **was stored** in `Email`. With `INotifyDataErrorInfo`, the view model holds whatever the user typed and *knows* it's invalid, which is what lets it decide, for example, that the Save command can't run while `HasErrors` is `true` (level 14's `CanExecute`). And because the rule is in the setter, it applied just the same when code set a valid address: the message cleared without the window doing anything.

**Break it on purpose:** a common older style throws an exception from the setter: `set { if (value.Length > 3) throw new ArgumentException("Codes are at most 3 characters."); code = value; }`. Bind a `TextBox` to that and type `ABCD`: **nothing visible happens**. The binding catches the exception, writes `System.Windows.Data Error: 8 : Cannot save value from target back to source` to the trace, and the box shows no error at all (measured). Only with `ValidatesOnExceptions=True` on the binding does the exception become a validation error, with its message. Don't validate by throwing; use one of the three layers above.

**SE lens:** Use each layer for what it's good at. **Conversion** catches "not a number" for free. A **`ValidationRule`** suits format checks on the raw text that are about the *view*, such as a colour code in a theme editor. **`INotifyDataErrorInfo`** is for everything that's a rule of the application: it's testable, it applies however a value arrives, and it can check one property against another. CommunityToolkit.Mvvm's `ObservableValidator` (the toolkit of level 26, used in the level 37 capstone) implements this interface for you, with attributes such as `[Required]` and `[EmailAddress]`.

## Challenge: signup_form

Implement `INotifyDataErrorInfo` in `SignupForm` (`SignupForm.cs`), the view model of a read-only sign-up window. The rules, with these exact messages:

- **`Email`** must contain `@`: otherwise `Enter a valid email address.`
- **`Password`** must be at least 8 characters: otherwise `Use at least 8 characters.`
- **`Confirm`** must equal `Password`: otherwise `Passwords don't match.` This must be re-checked when **either** of the two changes.
- **`CanSubmit`** is `true` only when there are no errors **and** all three fields have been filled in.

Each property reports at most one message. The starter stores the values; you add the checks and the interface.

```challenge wpf file=SignupForm.cs
using System.Collections;
using System.ComponentModel;

namespace LessonApp;

public class SignupForm
{
    private string email = "", password = "", confirm = "";

    public string Email { get => email; set => email = value; }
    public string Password { get => password; set => password = value; }
    public string Confirm { get => confirm; set => confirm = value; }

    public bool CanSubmit => false;
}
```

```challenge wpf file=MainWindow.xaml readonly
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Sign up" Width="320" Height="260">
    <StackPanel Margin="12">
        <TextBlock Text="Email"/>
        <TextBox x:Name="EmailBox" Text="{Binding Email}"/>
        <TextBlock x:Name="EmailError" Foreground="Firebrick" Text="{Binding (Validation.Errors)/ErrorContent, ElementName=EmailBox}"/>
        <TextBlock Text="Password"/>
        <TextBox x:Name="PasswordBox" Text="{Binding Password}"/>
        <TextBlock x:Name="PasswordError" Foreground="Firebrick" Text="{Binding (Validation.Errors)/ErrorContent, ElementName=PasswordBox}"/>
        <TextBlock Text="Confirm password"/>
        <TextBox x:Name="ConfirmBox" Text="{Binding Confirm}"/>
        <TextBlock x:Name="ConfirmError" Foreground="Firebrick" Text="{Binding (Validation.Errors)/ErrorContent, ElementName=ConfirmBox}"/>
    </StackPanel>
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
        DataContext = new SignupForm();
    }
}
```

```test
var form = new SignupForm();
assert form.CanSubmit == false   // nothing filled in yet
var window = Ui.Open<MainWindow>();
Ui.Type(window, "EmailBox", "ada");
Ui.Type(window, "PasswordBox", "letmein");   // 7 characters
assert Ui.Text(window, "EmailError") == "Enter a valid email address." && Ui.Text(window, "PasswordError") == "Use at least 8 characters."   // shown under the fields
Ui.Type(window, "PasswordBox", "correct horse");
Ui.Type(window, "ConfirmBox", "correct hose");
assert Ui.Text(window, "PasswordError") == "" && Ui.Text(window, "ConfirmError") == "Passwords don't match."
Ui.Type(window, "PasswordBox", "correct hose");
assert Ui.Text(window, "ConfirmError") == ""   // changing the password re-checked the confirmation
var signup = (SignupForm)window.DataContext;
assert ((System.ComponentModel.INotifyDataErrorInfo)signup).HasErrors && signup.CanSubmit == false   // the email is still wrong
Ui.Type(window, "EmailBox", "ada@example.com");
assert !((System.ComponentModel.INotifyDataErrorInfo)signup).HasErrors && signup.CanSubmit   // all valid and filled in
```
