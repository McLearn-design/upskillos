---
series: wpf-mastery
level: 23
title: Control Templates: Lookless Controls
lang: csharp
---

# Control Templates: Lookless Controls

A style can change a button's colours and padding, but not its *shape*: no style setter turns a rectangle into a pill or a check box into a sliding switch. That's because a WPF control has no built-in appearance at all. `Button` is clicking, focus, keyboard and command behaviour; everything you see comes from its **control template**, a tree of elements (level 9's visual tree) built for each button. Controls designed this way are called **lookless**. This lesson shows what's in a real template, writes new ones, connects them to the control's properties with `TemplateBinding`, gives them their own triggers, and explains the named `PART_` elements some controls need. You'll build a pill-shaped button and a toggle switch.

## A Control Is Behaviour; Its Template Is Its Looks

Every `Control` has a **`Template`** property holding a `ControlTemplate`. When the control is first laid out, WPF builds the template's elements and makes them the control's visual children: that's where level 9's `Border "border"` and `ContentPresenter "contentPresenter"` came from. The default template comes from the theme. `XamlWriter.Save(object)` writes any object back out as XAML, so it can show you the template you've been using:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="The default template" Width="300" Height="120">
    <StackPanel Margin="12">
        <Button x:Name="OkButton" Content="OK"/>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;
using System.Windows.Markup;

namespace LessonApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        string template = XamlWriter.Save(OkButton.Template);
        Console.WriteLine($"{template.Length} characters, {template.Split("<Setter ").Length - 1} setters, {template.Split("<Trigger ").Length - 1} triggers");
        Console.WriteLine(template.Replace("><", ">\n<"));
    }
}
```

`Split(...).Length - 1` counts occurrences of a piece of text. The output begins (shortened here; run it for the whole template):

```text
3006 characters, 10 setters, 5 triggers
<ControlTemplate TargetType="ButtonBase" ...>
<Border BorderThickness="{TemplateBinding Border.BorderThickness}" BorderBrush="{TemplateBinding Border.BorderBrush}" Background="{TemplateBinding Panel.Background}" Name="border" SnapsToDevicePixels="True">
<ContentPresenter RecognizesAccessKey="True" Content="{TemplateBinding ContentControl.Content}" ... Name="contentPresenter" Margin="{TemplateBinding Control.Padding}" HorizontalAlignment="{TemplateBinding Control.HorizontalContentAlignment}" .../>
</Border>
<ControlTemplate.Triggers>
...
```

The whole look of a standard button is one `Border` with one `ContentPresenter` inside, plus five triggers (for `IsDefaulted`, `IsMouseOver`, `IsPressed`, `IsChecked` and `IsEnabled`) that change the border's colours. Notice how the button's own properties reach the parts: the border's `Background` is `{TemplateBinding Panel.Background}`, and the presenter's `Margin` is `{TemplateBinding Control.Padding}`. **`Background` and `Padding` only work on a button because its template passes them on.** Replace the template, and they do whatever *your* template says.

## Writing a Template, and TemplateBinding

A `ControlTemplate` has a `TargetType` (the control it's for) and one root element. Here are two templates for the same button, written inline on the button with `<Button.Template>`. The first ignores the button's properties; the second passes them on with **`TemplateBinding`**:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Templates" Width="320" Height="170">
    <StackPanel Margin="12">
        <Button x:Name="Bare" Content="Bare template" Padding="20,10" Background="SteelBlue">
            <Button.Template>
                <ControlTemplate TargetType="Button">
                    <Border x:Name="Chrome" CornerRadius="12" BorderBrush="Gray" BorderThickness="1">
                        <ContentPresenter/>
                    </Border>
                </ControlTemplate>
            </Button.Template>
        </Button>
        <Button x:Name="Bound" Content="With TemplateBinding" Padding="20,10" Background="SteelBlue" Foreground="White" Margin="0,8,0,0">
            <Button.Template>
                <ControlTemplate TargetType="Button">
                    <Border x:Name="Chrome" CornerRadius="12" Background="{TemplateBinding Background}" Padding="{TemplateBinding Padding}">
                        <ContentPresenter HorizontalAlignment="Center"/>
                    </Border>
                </ControlTemplate>
            </Button.Template>
        </Button>
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
        Loaded += (_, _) =>
        {
            foreach (Button button in new[] { Bare, Bound })
            {
                var chrome = (Border)button.Template.FindName("Chrome", button);
                Console.WriteLine($"{button.Name,-5}: chrome background {chrome.Background?.ToString() ?? "null"}, padding {chrome.Padding}, button height {button.ActualHeight:0}");
            }
        };
    }
}
```

`button.Template.FindName("Chrome", button)` finds a part by name in the template's own name scope, as applied to that button (level 9): template names are never in the window's. The output:

```text
Bare : chrome background null, padding 0,0,0,0, button height 26
Bound: chrome background #FF4682B4, padding 20,10,20,10, button height 44
```

`Bare` set `Background="SteelBlue"` and `Padding="20,10"`, and neither had any effect: its template never reads them. `Bound` passed both to its border, so it's blue and 18 pixels taller. Launch it: both are still real buttons (click them, tab to them, press Space), with none of the default look.

- **`{TemplateBinding Background}`** is a lightweight one-way binding from a property of the **templated control** (the button) to a property of a template part. It only works inside a template.
- **`ContentPresenter`** shows the control's `Content` (level 9's three rules). Inside a template for a `ContentControl`, it picks up `Content`, `ContentTemplate` and `ContentStringFormat` automatically, which is why `<ContentPresenter/>` with no attributes worked.
- For a two-way connection, or one through a converter (level 16), use the full form: `{Binding Background, RelativeSource={RelativeSource TemplatedParent}}`.

## Template Triggers

A template can have its own **`ControlTemplate.Triggers`**. They watch the templated control's properties (`IsMouseOver`, `IsPressed`, `IsEnabled`, `IsChecked`...) and set properties of **named parts**, with `TargetName`. This is the layer level 21's style triggers couldn't beat: template triggers set the parts directly. Now it's your template, so the template triggers are yours too:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Template triggers" Width="300" Height="140">
    <StackPanel Margin="12">
        <Button x:Name="SaveButton" Content="Save" Padding="16,6" Background="#2563EB" Foreground="White" HorizontalAlignment="Left">
            <Button.Template>
                <ControlTemplate TargetType="Button">
                    <Border x:Name="Chrome" CornerRadius="6" Background="{TemplateBinding Background}" Padding="{TemplateBinding Padding}">
                        <ContentPresenter/>
                    </Border>
                    <ControlTemplate.Triggers>
                        <Trigger Property="IsMouseOver" Value="True">
                            <Setter TargetName="Chrome" Property="Background" Value="#1D4ED8"/>
                        </Trigger>
                        <Trigger Property="IsEnabled" Value="False">
                            <Setter TargetName="Chrome" Property="Background" Value="#94A3B8"/>
                        </Trigger>
                    </ControlTemplate.Triggers>
                </ControlTemplate>
            </Button.Template>
        </Button>
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
        Loaded += (_, _) =>
        {
            var chrome = (Border)SaveButton.Template.FindName("Chrome", SaveButton);
            Console.WriteLine($"enabled:  {chrome.Background}");
            SaveButton.IsEnabled = false;
            Console.WriteLine($"disabled: {chrome.Background}");
        };
    }
}
```

The output:

```text
enabled:  #FF2563EB
disabled: #FF94A3B8
```

Launch it and hover: the button darkens. Without the `IsMouseOver` trigger it would give no feedback at all, because the default template's hover trigger left with the default template. **A new template must re-create every state it needs:** hover, pressed, disabled, keyboard focus.

**SE lens:** Re-templating is powerful and easy to get subtly wrong. A template without a focus indication makes the app unusable from the keyboard; one with hard-coded colours ignores Windows' high-contrast mode, which the default templates honour. Use a style (level 21) when you only need different values, and a template when you need a different structure. When you do write one, start from the default (Visual Studio's *Edit Template → Edit a Copy* writes it into your XAML, and `XamlWriter` shows it) and change it, rather than starting from nothing.

## Challenge: pill_button

Write a style with key **`PillButton`** for `Button`, in the window's resources, whose `Template` setter gives a button a pill shape. The template's root must be a `Border` named **`Chrome`** with:

- `CornerRadius` **14**;
- its `Background`, `BorderBrush`, `BorderThickness` and `Padding` taken from the **button's own** properties;
- a `ContentPresenter` inside, centred horizontally and vertically.

And a template trigger: while the button **is disabled**, `Chrome`'s `Opacity` is **0.5**. The window (read-only below) has two buttons using the style, with different colours.

A setter whose value is an object, like a template, is written in element form: `<Setter Property="Template"><Setter.Value><ControlTemplate ...>...</ControlTemplate></Setter.Value></Setter>`.

```challenge wpf file=Styles.xaml
<ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
                    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
    <!-- TODO: the PillButton style -->
    <Style x:Key="PillButton" TargetType="Button"/>
</ResourceDictionary>
```

```challenge wpf file=MainWindow.xaml readonly
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Pills" Width="320" Height="160">
    <Window.Resources>
        <ResourceDictionary Source="Styles.xaml"/>
    </Window.Resources>
    <StackPanel Margin="12" Orientation="Horizontal" VerticalAlignment="Top">
        <Button x:Name="Accept" Content="Accept" Style="{StaticResource PillButton}" Background="#16A34A" BorderBrush="#166534" BorderThickness="2" Padding="18,6" Foreground="White"/>
        <Button x:Name="Decline" Content="Decline" Style="{StaticResource PillButton}" Background="#E2E8F0" BorderBrush="#94A3B8" BorderThickness="1" Padding="10,4" Margin="8,0,0,0"/>
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
    }
}
```

```test
var window = Ui.Open<MainWindow>();
var accept = Ui.Find<System.Windows.Controls.Button>(window, "Accept");
var decline = Ui.Find<System.Windows.Controls.Button>(window, "Decline");
var acceptChrome = accept.Template.FindName("Chrome", accept) as System.Windows.Controls.Border;
var declineChrome = decline.Template.FindName("Chrome", decline) as System.Windows.Controls.Border;
assert acceptChrome != null && acceptChrome.CornerRadius.TopLeft == 14 && acceptChrome.CornerRadius.BottomRight == 14   // the template's root is the Chrome border
assert ((System.Windows.Media.SolidColorBrush)acceptChrome!.Background).Color.ToString() == "#FF16A34A" && ((System.Windows.Media.SolidColorBrush)declineChrome!.Background).Color.ToString() == "#FFE2E8F0"   // each button's own background
assert acceptChrome.Padding == new System.Windows.Thickness(18, 6, 18, 6) && declineChrome.BorderThickness == new System.Windows.Thickness(1) && ((System.Windows.Media.SolidColorBrush)declineChrome.BorderBrush).Color.ToString() == "#FF94A3B8"   // padding and border passed on
assert Ui.Text(window, "Accept") == "Accept" && Probe.Texts(accept).Contains("Accept")   // the content is presented
decline.IsEnabled = false; Ui.Flush();
assert declineChrome.Opacity == 0.5 && acceptChrome.Opacity == 1   // only the disabled one fades
```

```challenge wpf file=Probe.cs readonly
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace LessonApp;

public static class Probe
{
    // The text of every TextBlock drawn under an element (level 9's visual tree).
    public static List<string> Texts(DependencyObject parent)
    {
        var texts = new List<string>();
        if (parent is TextBlock block) texts.Add(block.Text);
        for (int index = 0; index < VisualTreeHelper.GetChildrenCount(parent); index++)
            texts.AddRange(Texts(VisualTreeHelper.GetChild(parent, index)));
        return texts;
    }
}
```

## Named Parts: How a Lookless Control Finds Its Pieces

A `Button` needs nothing from its template: it doesn't care what's inside. Some controls do. A `ProgressBar` must make *some* element as wide as its value; a `Slider` must know which element is the draggable thumb track; a `TextBox` needs a place to put the editable text. They find those elements **by name** in the template, through names that start with `PART_`, and declare them with `[TemplatePart]` attributes on the class, which you can read by reflection (level 2):

```text
ProgressBar   PART_Track, PART_Indicator, PART_GlowRect
Slider        PART_Track (a Track), PART_SelectionRange
ScrollViewer  PART_HorizontalScrollBar, PART_VerticalScrollBar, PART_ScrollContentPresenter
TextBox       PART_ContentHost
ComboBox      PART_EditableTextBox, PART_Popup
```

When the template is applied, the control looks the names up (in its `OnApplyTemplate` method) and drives those elements. This window gives two progress bars the same template, except for the names:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Named parts" Width="320" Height="130">
    <StackPanel Margin="12">
        <ProgressBar x:Name="WithPartNames" Height="16" Value="40">
            <ProgressBar.Template>
                <ControlTemplate TargetType="ProgressBar">
                    <Grid>
                        <Border x:Name="PART_Track" Background="LightGray" CornerRadius="8"/>
                        <Border x:Name="PART_Indicator" Background="SeaGreen" CornerRadius="8" HorizontalAlignment="Left"/>
                    </Grid>
                </ControlTemplate>
            </ProgressBar.Template>
        </ProgressBar>
        <ProgressBar x:Name="WithOtherNames" Height="16" Value="40" Margin="0,8,0,0">
            <ProgressBar.Template>
                <ControlTemplate TargetType="ProgressBar">
                    <Grid>
                        <Border x:Name="Track" Background="LightGray" CornerRadius="8"/>
                        <Border x:Name="Indicator" Background="SeaGreen" CornerRadius="8" HorizontalAlignment="Left"/>
                    </Grid>
                </ControlTemplate>
            </ProgressBar.Template>
        </ProgressBar>
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
        Loaded += (_, _) =>
        {
            var named = (Border)WithPartNames.Template.FindName("PART_Indicator", WithPartNames);
            var other = (Border)WithOtherNames.Template.FindName("Indicator", WithOtherNames);
            Console.WriteLine($"PART_Indicator: {named.ActualWidth:0} of {WithPartNames.ActualWidth:0} wide");
            Console.WriteLine($"Indicator:      {other.ActualWidth:0} of {WithOtherNames.ActualWidth:0} wide");
        };
    }
}
```

The output:

```text
PART_Indicator: 112 of 280 wide
Indicator:      0 of 280 wide
```

With the `PART_` names, the progress bar found its indicator and made it 40% of the track's width. With other names, it found nothing, and the bar stays empty: no error, no warning. Controls are written to survive missing parts (a template may leave out an optional one), so a misspelt part name fails silently. When you re-template a control that declares parts, copy the part names exactly.

## Challenge: toggle_switch

Write a template that turns a `ToggleButton` (a button that stays pressed: `IsChecked` is `true` or `false`, and each click flips it) into a sliding switch. In `Styles.xaml`, write a style with key **`Switch`** for `ToggleButton` whose template is:

- a `Border` named **`Track`**, **44** wide and **24** tall, `CornerRadius` **12**, `Background` **`LightGray`**;
- inside it, an `Ellipse` named **`Knob`**, **18** by **18**, `Fill` **`White`**, with `Margin` **3**, at the **left** of the track (vertically centred);
- while **`IsChecked`** is `True`: the track's `Background` is **`SeaGreen`** and the knob is at the **right**.

`HorizontalAlignment="Left"` or `"Right"` places the knob; a template trigger can set it.

```challenge wpf file=Styles.xaml
<ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
                    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
    <!-- TODO: the Switch style -->
    <Style x:Key="Switch" TargetType="ToggleButton"/>
</ResourceDictionary>
```

```challenge wpf file=MainWindow.xaml readonly
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Settings" Width="300" Height="140">
    <Window.Resources>
        <ResourceDictionary Source="Styles.xaml"/>
    </Window.Resources>
    <StackPanel Margin="12" Orientation="Horizontal">
        <TextBlock Text="Dark mode" VerticalAlignment="Center" Margin="0,0,12,0"/>
        <ToggleButton x:Name="DarkMode" Style="{StaticResource Switch}"/>
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
    }
}
```

```test
var window = Ui.Open<MainWindow>();
var toggle = Ui.Find<System.Windows.Controls.Primitives.ToggleButton>(window, "DarkMode");
var track = toggle.Template.FindName("Track", toggle) as System.Windows.Controls.Border;
var knob = toggle.Template.FindName("Knob", toggle) as System.Windows.Shapes.Ellipse;
assert track != null && knob != null && track.ActualWidth == 44 && track.ActualHeight == 24 && track.CornerRadius.TopLeft == 12   // the two parts, sized as specified
assert ((System.Windows.Media.SolidColorBrush)track!.Background).Color.ToString() == "#FFD3D3D3" && Math.Abs(knob!.TranslatePoint(new System.Windows.Point(), track).X - 3) < 0.5   // off: gray, knob at the left
Ui.Click(window, "DarkMode");
assert toggle.IsChecked == true   // still a working toggle
assert ((System.Windows.Media.SolidColorBrush)track.Background).Color.ToString() == "#FF2E8B57" && Math.Abs(knob.TranslatePoint(new System.Windows.Point(), track).X - 23) < 0.5   // on: green, knob at the right
Ui.Click(window, "DarkMode");
assert ((System.Windows.Media.SolidColorBrush)track.Background).Color.ToString() == "#FFD3D3D3" && Math.Abs(knob.TranslatePoint(new System.Windows.Point(), track).X - 3) < 0.5   // and back
```
