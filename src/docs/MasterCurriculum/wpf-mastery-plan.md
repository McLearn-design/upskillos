# WPF & .NET Mastery — Curriculum Plan

Status: all 39 levels (0–38) written and verified (2026-10-02). Series id `wpf-mastery` in the Lesson Engine
(`src/labs/lesson-engine/content/wpf-mastery/`). The examples and tests run in the
desktop app: every example launches a real window on the learner's own .NET SDK, and
challenges are tested by driving the learner's real UI (see
`src/engine/lesson/projects/wpf.ts`). On the website every step is readable, and learners
can type the code along in their own editor; only the Run buttons need the desktop app.

## Who it is for, and the goal

A programmer who already writes C++ or Python and knows C# syntax (C# Fundamentals,
or equivalent), and who wants to build many real WPF applications — not copy
snippets until something works, but know *why* each piece is there.

Learners in this position say WPF feels like **tribal knowledge**: the XAML "somehow"
connects to the C#, `{Binding Name}` "somehow" finds a property, `using` lines and
project files appear from templates, and nobody explains the machinery. This course's
rule is: **nothing is magic**. Every mechanism is opened up — the code the compiler
generates is shown, the framework's lookup rules are stated, and each pattern is
introduced as the answer to a problem the learner has just hit.

Finishing the course means being able to: structure a WPF application with MVVM and
dependency injection; explain how XAML, bindings, dependency properties, resources,
styles and templates work underneath; build custom controls; keep a UI responsive with
async code; persist data in SQLite; test view models; and ship the app.

## Teaching devices used throughout

- **Show the generated code.** XAML compiles into C# (`MainWindow.g.cs`), and
  CommunityToolkit.Mvvm's attributes generate properties and commands. Lessons show
  those files, so "magic" becomes ordinary code the learner can read.
- **The same thing two ways.** Build a window in XAML, then the same window in C#; bind
  in XAML, then create the same `Binding` object in C#. XAML is shown to be a notation
  for objects, nothing more.
- **Break it on purpose.** Each lesson names the mistakes people actually make (a typo
  in a binding path, a missing `PropertyChanged`, touching a control from a background
  thread) and lets the learner see the real symptom and error text.
- **C++ / Python bridges.** Where .NET differs from what a C++ or Python programmer
  expects (namespaces vs `#include`/`import`, assemblies vs libraries/modules, the GC,
  interfaces vs duck typing), the lesson says so explicitly.
- **Patterns as answers.** Observer, command, MVVM, dependency injection, repository,
  messenger: each is introduced when the code without it has become painful.

## Dependency order

Organised by dependency, not by technology (Contract Part 2). Each module needs the
ones before it. Level numbers are the files' `level:` values.

### Module A — How a .NET application is put together (levels 0–5)
The things C++ and Python programmers find most confusing, before any WPF.

| Level | Title | Makes explicit |
|---|---|---|
| 0 | From Source Code to a Running .NET App | SDK vs runtime; `dotnet build`; IL in an assembly (`.dll`); the CLR and JIT; what's in the output folder; compare C++ compile+link and Python's interpreter |
| 1 | Namespaces, `using` and Assemblies | a namespace is a naming scope, an assembly is a file — the two are independent (unlike `#include` / `import`); implicit and global usings; how the compiler finds a type |
| 2 | Reading Modern C# | *(written)* properties (`get`/`set`/`init`, computed), the three meanings of `=>`, null (`?`, `?.`, `??`, `!`, `int?`), `var`/`new()`/initializers/records, generics and **extension methods** (how to read `services.AddSingleton<IClock, SystemClock>()`), attributes and reflection |
| 3 | Project Files and NuGet Packages | *(written)* the SDK-style `.csproj` and its properties becoming assembly attributes; `PackageReference`, restore, the global packages folder, package DLLs copied to the output; transitive dependencies and NuGet's lowest-version rule; copying `appsettings.json` to the output; solutions, project references, `Directory.Build.props` |
| 4 | Interfaces: How the Framework Calls Your Code | *(written)* interfaces as contracts (vs C++ abstract classes and Python duck typing); `IComparable<T>` and `List.Sort`; `IEnumerable<T>`, `foreach` lowering, `yield`; `IDisposable` and `using` (vs RAII and `with`); programming to an interface (the step before DI) |
| 5 | Delegates, Events and Lambdas | *(written)* `Func`/`Action`/`Predicate` and delegate types; closures and the `for`-loop capture trap; events, `EventHandler<T>`, why the `event` keyword exists; the event memory leak (measured); LINQ's deferred execution |

Module A was renumbered on 2026-10-01 (only levels 0 and 1 were written then): a syntax level was added at 2, because modern C# syntax was what the learner found most opaque, and attributes and reflection moved into it (and into level 15, where binding uses reflection).

### Module B — How WPF works inside (levels 6–13)

| Level | Title | Makes explicit |
|---|---|---|
| 6 | Windows, XAML & Click Events | *(written)* XAML as objects, code-behind, StackPanel, `x:Name`, Click handlers |
| 7 | What XAML Compiles Into | *(written)* `x:Class` + `partial`; the generated `MainWindow.g.cs` (shown); `InitializeComponent`, BAML, `x:Name` fields; the same window written in C# |
| 8 | Layout: Grid, DockPanel and the Layout Pass | *(written)* the five panels; Grid's fixed/Auto/star sizes (measured); margin vs padding vs alignment; Measure/Arrange made visible with a logging panel; why a ListBox in a StackPanel neither scrolls nor virtualizes (10,000 rows: 2 s vs 0.1 s, measured); the `x:Name="Content"` collision |
| 9 | Content Models and the Two Trees | *(written)* the four content models read from `[ContentProperty]` by reflection; content as any object and the `ContentPresenter`'s three rules; MC3089, MC3024 and the string-in-a-panel crash (from real builds); item containers per `ItemsControl` (measured); one logical parent per element; both trees printed; which features use which tree; the visual tree is empty in the constructor; template parts and `Template.FindName`; Fluent theme renames them (measured); a `FindDescendant`/`FindAncestor` helper |
| 10 | Dependency Properties | *(written)* why a plain property can't be bound (the real XamlParseException); sparse value storage measured (89 properties on `Button`, 0 stored on a new one); `Register`, the identifier, metadata, the wrapper; XAML and bindings bypass the C# setter (measured); change, coerce and validate callbacks; `GetValueSource` and the precedence table; a binding is a local value, so assignment replaces it and `SetCurrentValue` doesn't (measured); inheritance, `TextElement.FontSize` on a panel (MC3072 without it), machine-dependent default font size |
| 11 | Attached Properties | *(written)* `Grid.Row` stored in the button's own value table, and silently ignored outside a grid (measured); `GetX`/`SetX` and MC3065 without `SetX`; `Register` vs `RegisterAttached`: whose metadata applies (a static owner throws; another class ignores callbacks and options: measured); a panel's own attached property and `AffectsParentArrange` (without it the layout stays stale: measured); attached behaviours subscribing in the change callback, on and off |
| 12 | Routed Events | *(written)* a real press traced through WPF's input pipeline (a raw input report, so hit testing and routing are WPF's own): tunnel then bubble; Tunnel/Bubble/Direct; `sender`, `Source`, `OriginalSource` (a template `TextBlock`: measured); `Handled`, a `Button` swallowing `MouseDown` before even its own handlers, `handledEventsToo` (measured); a handled Preview event suppresses its bubbling partner entirely (measured); one `ButtonBase.Click` handler for a keypad; `PreviewTextInput` filtering, and pasting bypasses it (measured); registering and raising your own routed event |
| 13 | The UI Thread, the Dispatcher and async | *(written)* the dispatcher queue, measured (0 timer ticks during 2 s of blocking work, 18 with `await Task.Run`); the cross-thread exception; `Dispatcher.Invoke`; how `await` leaves and returns to the UI thread; CPU-bound vs I/O-bound; `async void` only for handlers; `Progress<T>`; the `.Result` deadlock (reproduced) |

### Module C — Data binding in depth (levels 14–19)

| Level | Title | Makes explicit |
|---|---|---|
| 14 | Data Binding, Commands & MVVM | *(written)* bindings, `DataContext`, `INotifyPropertyChanged`, `ICommand`, MVVM overview |
| 15 | Binding Sources, Modes and Debugging | *(written)* the four sources (`DataContext`, `ElementName`, `RelativeSource` Self/AncestorType, `Source`/`x:Static`); paths resolved by reflection at run time: public properties only, not fields or private ones (measured), nested, indexed and attached paths; a trace listener printing binding errors to the console (real Error 40 text) and how to read one; `FallbackValue` (downgrades to a warning: measured), `TargetNullValue`; modes and their per-property defaults (measured), `OneTime`; `UpdateSourceTrigger` with real keystrokes (`LostFocus` vs `PropertyChanged`: measured); a live preview and a broken-bindings repair with `RelativeSource AncestorType` from a template |
| 16 | Value Converters and Formatting | *(written)* `StringFormat` codes, `{}` escaping; bindings format with the element's `Language` (en-US), not the Windows culture (measured under fr-FR) and the startup fix; `StringFormat` silently ignored on `Content` (measured) and `ContentStringFormat`; `IValueConverter` as a resource, `ConverterParameter`, `BooleanToVisibilityConverter`; `ConvertBack`: `UnsetValue` (validation error) vs `DoNothing` vs throwing (crash), all measured; banker's rounding in `Math.Round`; `MultiBinding` with `StringFormat` and `IMultiValueConverter`; converters for view concerns only |
| 17 | Lists: ObservableCollection and DataTemplates | *(written)* `ItemsSource`, `DisplayMemberPath`, `DataTemplate` (a row's `DataContext` is its item); `List<T>` vs `ObservableCollection<T>` (a bound `List` doesn't update, then crashes the app on the next layout: shown); an `ObservableObject`/`SetProperty` base with `[CallerMemberName]`; master/detail with `SelectedItem`; item-level change notification |
| 18 | Sorting, Filtering and Grouping | *(written)* the collection view between a list and its control; one shared default view (sorting it re-sorts every list bound to the collection; the collection itself unchanged: measured); `SortDescription`; added items sorted in, edited items not; live sorting, applied asynchronously (measured); `CustomSort` vs reflection (29 vs 235 ms on 100k: measured); `Filter` re-runs only on `Refresh()` and for added items (measured); grouping and `GroupStyle`, group order from the sorted view, virtualization off when grouping (10,000 vs 8 containers: measured); `CollectionViewSource` for independent views in XAML |
| 19 | Validation | *(written)* the three layers (conversion, `ValidationRule`, `INotifyDataErrorInfo`) all reporting through `Validation.HasError`/`Errors`; the red outline is an adorner (measured); `(Validation.Errors)[0]` fills the trace with Error 17 when valid, `(Validation.Errors)/ErrorContent` doesn't (measured); a message under the field and a tooltip trigger; rules see the raw text before conversion (measured); `INotifyDataErrorInfo` stores the invalid value and knows it; exceptions from setters are silently swallowed without `ValidatesOnExceptions` (measured); cross-property checks and `CanSubmit` |

### Module D — Look and feel (levels 20–25)

| Level | Title | Makes explicit |
|---|---|---|
| 20 | Resources and Resource Lookup | *(written)* resources as named objects (`sys:` types); lookup up the tree, nearest wins; the missing-key error (quoted from a real build); `StaticResource` vs `DynamicResource` measured on a swapped brush; merged dictionaries in their own file; a light/dark switch |
| 21 | Styles | *(written)* setters, keyed and implicit styles (exact type only: measured on a `ToggleButton`), `BasedOn`; value precedence and `ClearValue` (measured); `Trigger` and `DataTrigger`; why a style's `Background` loses to the template when disabled or hovered |
| 22 | Triggers and Visual States | *(written)* `MultiTrigger`/`MultiDataTrigger` for AND, separate triggers for OR; the later trigger wins (measured); why a trigger "does nothing" (a local value: measured; template triggers, 5 in Aero2 and 3 in Fluent: measured; equality-only conditions); `EventTrigger` previewed; `VisualStateManager` groups, states, `GoToElementState`; states apply asynchronously, an empty state undoes, a wrong name returns false (measured); animated colours print as `sc#` and compare unequal (measured, and `Ui.Color` fixed to format bytes); triggers vs visual states, and what happens when both drive one property (measured) |
| 23 | Control Templates: Lookless Controls | *(written)* lookless controls; the default Button template dumped with `XamlWriter` (3,006 characters, 10 setters, 5 triggers: measured); a bare template ignores `Background` and `Padding`, `TemplateBinding` passes them on (measured); `ContentPresenter`; `TemplatedParent` bindings; template triggers with `TargetName` and re-creating every state; accessibility and high-contrast cost; `PART_` names and `[TemplatePart]` (a `ProgressBar` with other names stays empty: measured); a pill button and a toggle switch |
| 24 | Data Templates by Type | *(written)* implicit `DataTemplate`s by `DataType`; the lookup rules, measured: exact type first, base classes count (unlike implicit styles), interfaces never apply, nearest resource wins, an explicit template stops the lookup; view-model-first pages with a `ContentControl` bound to `CurrentPage` (the template's `DataContext` is the page: measured); `DataTemplateSelector`, and a selector chooses once and doesn't re-run on property changes (measured) |
| 25 | Themes and Animation | *(written)* theme dictionaries swapped in `Application.Current.Resources`, every window following at once (measured with two windows); a theme service; Windows' `AppsUseLightTheme` setting and `UserPreferenceChanged`; the Fluent `ThemeMode` is a WPF0001 build error from C# on .NET 9 and 10 (measured); `DoubleAnimation`, `BeginAnimation`, storyboards, `EventTrigger`, easing; a finished animation holds its value so a later assignment does nothing, released by `BeginAnimation(null)` or `FillBehavior.Stop` (measured); animating `Width` costs 29 layout passes in 0.5 s and a `ScaleTransform` none (measured); reduced motion |

### Module E — Application architecture (levels 26–31)

| Level | Title | Makes explicit |
|---|---|---|
| 26 | MVVM Done Properly: CommunityToolkit.Mvvm | *(written)* `[ObservableProperty]` and the property it generates (quoted from the real build); partial methods `On…Changed`; `[RelayCommand]`, `CanExecute`, `[NotifyCanExecuteChangedFor]`, async commands' `IsRunning`; `[NotifyPropertyChangedFor]`; the two silent mistakes (missing `partial`: CS0260; writing the field: MVVMTK0034); why the partial-property form needs `LangVersion preview` with 8.4 |
| 27 | Async Commands: Busy, Cancel, Progress and Errors | *(written)* `IsRunning` bound in XAML; cooperative cancellation with `CancellationToken` and `IncludeCancelCommand` (a cancelled command leaves its state half-done unless it catches `OperationCanceledException`: measured); `Progress<T>` in a view model; an exception from a button-run async command ends the app (measured), so commands turn errors into state |
| 28 | The Generic Host: Dependency Injection, Configuration and Logging | *(written)* the composition root by hand, then `ServiceCollection`; singleton/scoped/transient (measured) and captive dependencies; `Host.CreateApplicationBuilder`, configuration sources and their order, environments, the options pattern; `ILogger<T>`, levels from `appsettings.json`, message templates; a WPF app whose window, view model and services all come from the host |
| 29 | Navigation and Dialogs | *(written)* navigation as a plain class with a back stack: `Current`, `NavigateTo`, `GoBack`, `CanGoBack`; going back returns the same view model with its state (measured); pages from a container, transient pages and a singleton navigator; `ShowDialog`, `DialogResult`, `IsDefault`/`IsCancel`, `Owner`, with each way of closing measured, and `DialogResult` on a non-dialog throwing (measured); why view models must not show dialogs (a dialog nobody answers blocks forever: the measuring probe hung); `IDialogService` with a real and a fake implementation; a delete command that asks first |
| 30 | Messaging Between View Models | *(written)* messages and recipients with `WeakReferenceMessenger` (`Register`, `Send`, `Unregister`), static handler lambdas, an injected `IMessenger`; request messages, `Reply`, `HasReceivedResponse`, and the exceptions for no answer and a second answer (measured); weak vs strong messengers: a forgotten recipient is collected only with the weak one, even with a capturing lambda (measured); handlers run on the sending thread (measured); events vs services vs messages |
| 31 | Testing View Models | *(written)* xUnit v3 test projects as programs (real runner output, and a deliberate failure: measured); arrange-act-assert, `[Fact]`, `[Theory]`/`[InlineData]` on both sides of a boundary; testing view-model properties, `Assert.PropertyChanged` (the missing-notification failure measured) and commands; fakes for services, async tests, `Task.FromResult`/`FromException`; mutation testing: the learner's tests are graded by running them against four mutants; making a `DateTime.Now` view model testable with `IClock` |

### Module F — Real applications (levels 32–38)

| Level | Title | Makes explicit |
|---|---|---|
| 32 | UserControls and Custom Controls | *(written)* a UserControl with dependency properties, `BindsTwoWayByDefault`, its own name scope; the `DataContext = this` trap measured (one parent binding fails with Error 40, the other silently binds the control's own `Name`); custom controls: `DefaultStyleKey`, `Themes/Generic.xaml`, `ThemeInfo`, `OnApplyTemplate`/`GetTemplateChild`, restyling without code changes; `TemplateBinding` does no type conversion (an int shown as empty: measured); choosing between the two; a star rating and a badge's default style |
| 33 | Files, Settings and JSON | *(written)* per-user data folders (`ApplicationData`, `LocalApplicationData`), never next to the exe; `System.Text.Json` writes public properties only, enums as numbers, ISO dates (measured); reading: case-sensitive names by default silently lose camelCase settings, `JsonSerializerDefaults.Web`, missing/unknown properties, the exceptions for bad, truncated and empty files, `null` (all measured); an atomic save through a temporary file and `File.Move(overwrite)`; a settings store and an exact export shape |
| 34 | SQLite and the Repository Pattern | *(written)* connections, commands, readers on SQLite; `Int64` results, `DBNull.Value` vs `null` (measured); SQL injection measured (an apostrophe crashes a concatenated query, `' OR '1'='1` returns every row) and parameters; transactions: 1,000 inserts 9,307 ms vs 15 ms, and all-or-nothing on failure (measured); the repository pattern behind an interface; Microsoft.Data.Sqlite's async methods complete synchronously (measured); `RETURNING Id` |
| 35 | Performance | *(written)* measure first (Stopwatch, counters, profilers); recycling vs standard virtualization (511 vs 11 containers scrolling 1,000 rows), `CanContentScroll=False` creating all 10,000 (measured); what silently disables virtualization; recycling's per-item-state rule; freezables: cross-thread exceptions, an unfrozen worker brush crashing the app at its next render, XAML resource brushes not frozen (all measured); bulk collection updates (5,000 events vs one replacement: measured) |
| 36 | Publishing and Deployment | *(written)* `dotnet publish`: framework-dependent, self-contained, single-file, all measured on one WPF app (1 MB/5 files to 141 MB/400 files, and one 134 MB file with native libraries bundled); `Assembly.Location` empty in single-file apps with warning IL3000 (measured), `AppContext.BaseDirectory`; trimming refused for WPF (NETSDK1168) and ReadyToRun with no gain on a small app (measured); `<Version>`, the informational version gaining `+commit` inside Git (measured); comparing versions as `Version`, not text; installers, updates, signing; first-run copying of default settings |
| 37 | Capstone 1: A Data-Entry App | *(written)* a contact book built layer by layer, each step reusing the previous steps' solutions read-only: `ObservableValidator` with validation attributes (validation runs only on change, `[EmailAddress]` rejects empty strings, custom messages: measured), the editor view model; an atomic JSON store; the screen view model (sorted, filtered view, selection to editor, add, save, confirmed delete); the window as bindings only; the composition root, which compiles (a WPF project's implicit usings omit `System.IO`: measured) |
| 38 | Capstone 2: A Tool Library Manager | *(written)* a tool library built in five layers, each step reusing the previous solutions read-only: two tables, a foreign key and `LEFT JOIN` with the open-loan filter in `ON` (in `WHERE` it drops tools: measured); a repository; lending rules over an `IClock`; the learner's own xUnit tests graded by four mutants; an async screen view model; a composition root tested through the container; the final `Main`, which compiles |

## Engine work the plan depends on

| Needed from | Capability | Status |
|---|---|---|
| Module B onwards | WPF project lessons: multi-file, launch, UI tests | done |
| Module A | Console project template (no WPF) | done |
| Level 7, 26 | Show the build's generated files (`*.g.cs`, source-generator output) — the **{ } Generated code** button | done |
| Levels 3, 26–34 | NuGet packages: a lesson supplies its own `LessonApp.csproj` (with `PackageReference`s); the runner retargets its `TargetFramework` to the installed SDK and restores from nuget.org | done (2026-10-01) |
| Level 28 | A lesson's own `Main` (an `App` that starts a host): the WPF launcher stays out when the lesson's files contain a `Main` | done (2026-10-01) |
| All levels | Verification on the real SDK: `src/engine/lesson/wpfMastery.desktop.test.ts` builds every example, runs console ones, checks every challenge's starter fails and its reference solution (`__fixtures__/wpf-mastery-solutions.json`) passes | done (2026-10-01) |
| Level 31 | Running an xUnit test project | done (2026-10-02): an `xunit.v3` console project runs its own tests when launched; `projectRunner.ts` recognises its generated entry point (`generatesXunitMain`) |
| Module F | Saving the learner's work between sessions | to do |

## Progress

Written and verified end to end on a real .NET 10 SDK (every example built and run,
every challenge passed by a correct answer and failed by targeted wrong answers, every
quoted error built): levels 0, 1, 6, 7, 14; then 2, 3, 4, 5, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37 and 38 (2026-10-01/02;
the hosted WPF app in level 28 was also launched and driven with UI Automation, and
level 8 and 17's windows were rendered to images and checked). Verification caught two wrong claims before
publishing: a XAML error message quoted from memory (level 6), and "assemblies load
when the line runs" (level 1 — they load when the JIT compiles the method). Level 9 had
two more: a visual-tree element count carried over from a different probe window (54;
the lesson's window has 24), and a challenge heading named `x:Name="Title"`, which
collides with `Window.Title` (the CS0108 trap level 8 teaches).

Levels 10–38 (2026-10-02) were checked the same way, and the checks changed the
lessons as follows:

- **Wrong claims corrected after measuring:** `Register` and `RegisterAttached` differ
  in whose metadata applies, not only in use (11); an animation doesn't always beat a
  trigger when the trigger replaces the brush being animated (22); the Fluent
  `ThemeMode` API is a build *error* from C#, on .NET 9 and 10 (25); `TemplateBinding`
  does no type conversion, so an `int` shows as empty text (32); the `DataContext = this`
  trap also binds silently to the control's own `Name` (32); `ObservableValidator` was
  said to be taught in level 26 and wasn't, so level 37 teaches it (19, 37).
- **Guessed outputs replaced with measured ones** (10, 11, 15, 16, 31, 35), including one
  example that crashed as first written (10) and one whose numbers came from a
  different probe window (35).
- **Weak tests strengthened**, because a wrong answer passed them: groups sorted by
  title alone happened to come out alphabetical (18), a 5-character "short" password
  (19), no prefix search (34), `CanExecute` read directly instead of watching
  `CanExecuteChanged`, and `Ui.Type` hiding a `LostFocus` binding (37).
- **A reference solution failed its own test:** `Math.Round(12.5)` is 12 (banker's
  rounding), now taught in level 16's challenge.
- **Engine fixes found by the lessons:** `Ui.Color` formats colour bytes itself, because
  `Color.ToString()` prints an animated colour as `sc#…` (22); xUnit v3 projects run as
  programs (`generatesXunitMain`, 31); the web app's message for WPF lessons now says
  learners can follow along in their own editor.
- **Build facts found on the way:** a WPF project's implicit usings omit `System.IO`
  (37); a WPF `Main` must be `[STAThread]`, so a composition root can't use top-level
  statements (37).

## Rules for writing each lesson

Contract Parts 0 and 3 apply, plus the WPF project rules in Part 4 ("Project Steps").
In particular: build every example; run every challenge with a correct answer and with
wrong answers that each break one requirement; and build any compiler error the prose
quotes rather than quoting it from memory.

- **The learner types.** Each lesson has several small challenges placed right after the
  concept they practise (4–6 assertions each, per the corpus test), not one at the end:
  the learner writes the code and the tests check it.
- **Add the reference solution** to `src/engine/lesson/__fixtures__/wpf-mastery-solutions.json`
  and run `npx vitest run src/engine/lesson/wpfMastery.desktop.test.ts -t "level-N:"`.
- **C# that is shown but not run** goes in a ```` ```dotnet ```` fence (highlighted as C#):
  a ```` ```csharp ```` fence is a runnable single-file example to the engine.
