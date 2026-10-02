---
series: wpf-mastery
level: 30
title: Messaging Between View Models
lang: csharp
---

# Messaging Between View Models

A shop window has a product page and, in its header, a cart badge showing how many items are in the cart. When the product page adds an item, the badge must update. The two view models don't know each other: different pages, created at different times, maybe by a container (level 28). Give the product page a reference to the header and they're tied together; route everything through the main view model and it becomes a switchboard that knows every page. A **messenger** decouples them: one view model *sends* a message object, any number of others *receive* it, and neither knows the other exists. This lesson uses CommunityToolkit.Mvvm's messenger (the same package as level 26). It covers messages and recipients, request messages that get an answer, why the **weak** messenger doesn't leak the way level 5's events did, and which thread a message arrives on. You'll connect a cart to its badge and let a report ask who is logged in.

## Sending and Receiving

A **message** is an ordinary class; its type is what recipients subscribe to. The toolkit provides base classes for the common shapes: **`ValueChangedMessage<T>`** carries one value. A **messenger**, an `IMessenger`, delivers messages:

- **`messenger.Register<TRecipient, TMessage>(recipient, handler)`** subscribes `recipient` to messages of type `TMessage`; the `handler` is called with the recipient and the message.
- **`messenger.Send(message)`** delivers the message to every registered recipient of its type, then returns it.
- **`messenger.Unregister<TMessage>(recipient)`** ends one subscription; `UnregisterAll(recipient)` ends all of them.

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

```project console file=Program.cs
using CommunityToolkit.Mvvm.Messaging;
using CommunityToolkit.Mvvm.Messaging.Messages;

IMessenger messenger = new WeakReferenceMessenger();
var header = new HeaderViewModel(messenger);
var sidebar = new SidebarViewModel(messenger);
var product = new ProductViewModel(messenger);

product.AddToCart();
product.AddToCart();
Console.WriteLine($"header shows {header.CartCount}, sidebar shows {sidebar.CartCount}");

public sealed class CartChangedMessage : ValueChangedMessage<int>
{
    public CartChangedMessage(int count) : base(count) { }
}

public class ProductViewModel(IMessenger messenger)
{
    private int itemsInCart;

    public void AddToCart()
    {
        itemsInCart++;
        Console.WriteLine($"product page: sending CartChangedMessage({itemsInCart})");
        messenger.Send(new CartChangedMessage(itemsInCart));
    }
}

public class HeaderViewModel
{
    public int CartCount { get; private set; }

    public HeaderViewModel(IMessenger messenger) =>
        messenger.Register<HeaderViewModel, CartChangedMessage>(this, static (header, message) => header.CartCount = message.Value);
}

public class SidebarViewModel
{
    public int CartCount { get; private set; }

    public SidebarViewModel(IMessenger messenger) =>
        messenger.Register<SidebarViewModel, CartChangedMessage>(this, static (sidebar, message) => sidebar.CartCount = message.Value);
}
```

`class ProductViewModel(IMessenger messenger)` is a **primary constructor** (C# 12): the parameter `messenger` is available throughout the class without a field. `ValueChangedMessage<int>` stores the value passed to `base(count)` in its `Value` property. The handlers are **`static` lambdas** that receive the recipient as their first parameter, so they don't capture `this`; that's the toolkit's recommended form. The output:

```text
product page: sending CartChangedMessage(1)
product page: sending CartChangedMessage(2)
header shows 2, sidebar shows 2
```

`ProductViewModel` has no reference to the header or the sidebar, and adding a third listener needs no change to it. The only thing they share is the message type, and the messenger, which in an app is registered once in the container: `services.AddSingleton<IMessenger>(WeakReferenceMessenger.Default)`. Taking `IMessenger` in the constructor (instead of reaching for the static `WeakReferenceMessenger.Default`) lets a test give each view model a fresh, private messenger.

**CS lens:** This is the **publish–subscribe** pattern, with the messenger as a **mediator**: senders and receivers depend on the message contract, not on each other. It's the same idea as level 5's events, with one difference that matters: an event's subscriber must know the publisher to write `publisher.Event += ...`; here neither side knows the other.

## Request Messages: Asking a Question

Some messages want an answer: "who is logged in?", "is there unsaved work?". A **`RequestMessage<T>`** is sent like any message, and one recipient answers by calling **`Reply(value)`** on it. The sender reads the answer from the returned message's **`Response`**:

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

```project console file=Program.cs
using CommunityToolkit.Mvvm.Messaging;
using CommunityToolkit.Mvvm.Messaging.Messages;

IMessenger messenger = new WeakReferenceMessenger();

var unanswered = messenger.Send(new CurrentUserRequest());
Console.WriteLine($"before anyone answers: HasReceivedResponse = {unanswered.HasReceivedResponse}");
try
{
    string user = unanswered.Response;
}
catch (InvalidOperationException error)
{
    Console.WriteLine($"reading Response anyway: {error.Message}");
}

var session = new SessionViewModel(messenger, "ada");
var answered = messenger.Send(new CurrentUserRequest());
Console.WriteLine($"after the session registers: {answered.Response}");

public sealed class CurrentUserRequest : RequestMessage<string> { }

public class SessionViewModel
{
    public string UserName { get; }

    public SessionViewModel(IMessenger messenger, string userName)
    {
        UserName = userName;
        messenger.Register<SessionViewModel, CurrentUserRequest>(this, static (session, request) => request.Reply(session.UserName));
    }
}
```

The output:

```text
before anyone answers: HasReceivedResponse = False
reading Response anyway: No response was received for the given request message.
after the session registers: ada
```

A request nobody answers doesn't fail when sent. It fails when you **read** `Response`, with an `InvalidOperationException`. Check **`HasReceivedResponse`** first whenever no answer is a real possibility. Only one recipient may reply: with two registered repliers, the second `Reply` throws `InvalidOperationException: A response has already been issued for the current message.` (measured).

## Challenge: cart_badge

Connect a cart to its badge through a messenger. In `Cart.cs`, using the given `CartChangedMessage`:

- **`CartViewModel`**: `Add(string item)` and `Remove(string item)` change its `Items` list and then **send** a `CartChangedMessage` carrying the new number of items. Removing an item that isn't in the cart changes nothing and sends nothing.
- **`CartBadgeViewModel`**: **registers** for `CartChangedMessage` in its constructor and keeps `Count` equal to the latest value received. `Text` is `""` when the count is 0 and the count as a string otherwise (`"3"`).

Both take the `IMessenger` to use in their constructors.

```challenge console file=Cart.cs
using CommunityToolkit.Mvvm.Messaging;
using CommunityToolkit.Mvvm.Messaging.Messages;

namespace LessonApp;

public sealed class CartChangedMessage : ValueChangedMessage<int>
{
    public CartChangedMessage(int count) : base(count) { }
}

public class CartViewModel
{
    public CartViewModel(IMessenger messenger) { }

    public List<string> Items { get; } = new();

    public void Add(string item) { }

    public void Remove(string item) { }
}

public class CartBadgeViewModel
{
    public CartBadgeViewModel(IMessenger messenger) { }

    public int Count { get; private set; }

    public string Text => "";
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
var messenger = new CommunityToolkit.Mvvm.Messaging.WeakReferenceMessenger();
var cart = new CartViewModel(messenger);
var badge = new CartBadgeViewModel(messenger);
assert badge.Count == 0 && badge.Text == ""   // an empty cart shows no number
cart.Add("tea"); cart.Add("coffee"); cart.Add("cocoa");
assert badge.Count == 3 && badge.Text == "3"   // the badge heard every change
cart.Remove("coffee");
assert badge.Count == 2 && cart.Items.SequenceEqual(new[] { "tea", "cocoa" })
var secondBadge = new CartBadgeViewModel(messenger); var sent = 0; var listener = new object(); CommunityToolkit.Mvvm.Messaging.IMessengerExtensions.Register<CartChangedMessage>(messenger, listener, (_, _) => sent++);
cart.Remove("milk");
assert sent == 0 && badge.Count == 2   // removing something that isn't there sends nothing
cart.Remove("tea"); cart.Remove("cocoa");
assert badge.Text == "" && secondBadge.Count == 0   // back to empty; a badge created later hears changes too
```

## Why the Weak Messenger Doesn't Leak

Level 5 measured the classic event leak: a closed panel that forgot `-=` stayed alive, because the publisher's event held a reference to it. A messenger is a long-lived publisher too, so the same leak threatens every view model that registers and forgets to unregister. The toolkit has two messengers, and they differ exactly here:

- **`WeakReferenceMessenger`** holds recipients through **weak references**: references the garbage collector ignores when deciding whether an object is still in use. A recipient nothing else refers to can be collected, and its registrations disappear with it.
- **`StrongReferenceMessenger`** holds ordinary references. It's faster, and like an event, it keeps every registered recipient alive until it's unregistered.

Measured: register a badge with each messenger, drop every other reference to it, and force a garbage collection (`GC.Collect()`, level 5):

```text
weak:   forgotten badge alive after GC: False   (and it received nothing afterwards)
strong: forgotten badge alive after GC: True    (and it still handled the next message)
```

The same held for a badge whose handler was a lambda capturing `this` instead of the `static` form: still collected with the weak messenger. So with `WeakReferenceMessenger`, forgetting to unregister costs a little work, not a leak. Unregistering is still right when a page closes but stays referenced somewhere, such as in level 29's back stack, because a live recipient keeps receiving.

**SE lens:** Use `WeakReferenceMessenger` (its static `Default` instance, or one registered in the container) unless profiling shows the messenger is a bottleneck. Give each message type one clear meaning, named in the past tense for things that happened (`CartChangedMessage`, `OrderSavedMessage`) or as a question for requests (`CurrentUserRequest`). The danger of messaging is that it's *too* easy: when every view model sends everything, nobody can tell who reacts to what. If two objects have an obvious owner relationship, a direct reference or an event is clearer.

## Which Thread a Message Arrives On

`Send` calls every handler **immediately, on the thread that called `Send`**, before it returns. Measured: a message sent from inside `Task.Run` (level 13) was handled on thread 4, while the program's main thread was thread 2. In a WPF app this matters: a view model handling a message sent from a background task must not touch anything bound to the UI directly, because WPF objects belong to the UI thread (level 13). Either send from the UI thread (after the `await`), or have the handler hop back with `Application.Current.Dispatcher.Invoke(...)`.

The rules for when to use what:

| Need | Use |
|---|---|
| a child tells its owner something (a dialog's result, a button's click) | a C# event (level 5), or a callback passed in |
| a view model needs a service's data or action | inject the service (level 28) |
| unrelated parts react to something that happened (cart changed, user logged out, theme switched) | a message |
| one part needs an answer from another it shouldn't reference | a request message |

## Challenge: report_title

A report page asks who is logged in through a messenger. In `Report.cs`, using the given `CurrentUserRequest`:

- **`SessionViewModel`** answers every `CurrentUserRequest` with its `UserName` while it's signed in. **`SignOut()`** stops it answering (unregister).
- **`ReportViewModel.BuildTitle()`** sends a `CurrentUserRequest` and returns **`Report for <user>`**, or **`Report for nobody`** when no one answered.

`messenger.Unregister<TMessage>(recipient)` ends one subscription.

```challenge console file=Report.cs
using CommunityToolkit.Mvvm.Messaging;
using CommunityToolkit.Mvvm.Messaging.Messages;

namespace LessonApp;

public sealed class CurrentUserRequest : RequestMessage<string> { }

public class SessionViewModel
{
    public SessionViewModel(IMessenger messenger, string userName) => UserName = userName;

    public string UserName { get; }

    public void SignOut() { }
}

public class ReportViewModel
{
    public ReportViewModel(IMessenger messenger) { }

    public string BuildTitle() => "";
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
var messenger = new CommunityToolkit.Mvvm.Messaging.WeakReferenceMessenger();
var report = new ReportViewModel(messenger);
assert report.BuildTitle() == "Report for nobody"   // no session yet: no answer, no exception
var session = new SessionViewModel(messenger, "ada");
assert report.BuildTitle() == "Report for ada"
session.SignOut();
assert report.BuildTitle() == "Report for nobody"   // signed out: it stopped answering
var other = new SessionViewModel(messenger, "grace");
assert report.BuildTitle() == "Report for grace"   // a new session answers
```
