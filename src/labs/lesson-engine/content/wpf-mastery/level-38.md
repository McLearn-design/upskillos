---
series: wpf-mastery
level: 38
title: Capstone 2: A Tool Library Manager
lang: csharp
---

# Capstone 2: A Tool Library Manager

A community workshop lends tools: a drill to one member this week, a ladder to another. This capstone builds the app that runs it, with **SQLite** storage, **rules** that depend on today's date, **your own tests** checked by mutants, an **asynchronous** screen, and a **dependency-injection host** that wires it all. Capstone 1 was about building a screen; this one is about the layers behind it: a database with two related tables (and the one new SQL idea that needs, the `JOIN`), business rules kept out of both the database and the view model, and a composition root you can test. As before, each step gives you the finished earlier steps read-only.

## The Plan

```text
LibraryViewModel        the screen: search, select, lend, return, status           (levels 14, 26, 27)
   │ uses                       │ uses
LendingService          ILibraryRepository                                       (levels 4, 28)
   rules: who can borrow,       SqliteLibraryRepository: Tools and Loans tables  (level 34)
   when it's due, overdue       FakeLibraryRepository: in memory, for tests      (level 31)
   │ uses
IClock                  SystemClock in the app, FakeClock in tests                (level 31)

AppHost                 the composition root: registers all of it                  (level 28)
```

The data, in `Library.cs` (read-only in every step):

- `ToolStatus(long Id, string Name, string Category, string? Borrower, DateOnly? DueOn)`: a tool as the screen shows it, with the borrower and due date of its **open** loan, if it has one, and `IsAvailable` when it hasn't.
- `Loan(long Id, long ToolId, string Borrower, DateOnly LentOn, DateOnly DueOn, DateOnly? ReturnedOn)`: one lending; `ReturnedOn` is `null` while the tool is still out.
- **`DateOnly`** is a date without a time of day, the right type for "due on 16 March". `date.AddDays(7)` moves it; `<` and `>` compare dates.

## Two Tables and a JOIN

Tools and loans are separate tables, because a tool has many loans over its life. The `Loans` table refers to its tool by `ToolId`, declared with **`REFERENCES Tools(Id)`**: a **foreign key**, a column holding another table's key. To show tools *with* their current borrower, a query must combine rows from both tables. That's a **`JOIN`**:

- `FROM Tools JOIN Loans ON Loans.ToolId = Tools.Id` pairs each tool with each of its loans, and leaves out tools with no matching loan.
- **`LEFT JOIN`** keeps every row of the left table (`Tools`), filling the right table's columns with `NULL` where nothing matches.
- **`ON`** says which rows match; **`WHERE`** then filters the combined rows.

Which condition goes where matters, measured with three tools, the Drill lent to Ada (still out) and the Saw lent to Grace (returned):

```project console file=Program.cs
using Microsoft.Data.Sqlite;

using var connection = new SqliteConnection("Data Source=:memory:");
connection.Open();
Run("""
    CREATE TABLE Tools (Id INTEGER PRIMARY KEY, Name TEXT NOT NULL);
    CREATE TABLE Loans (Id INTEGER PRIMARY KEY, ToolId INTEGER NOT NULL REFERENCES Tools(Id), Borrower TEXT NOT NULL, ReturnedOn TEXT NULL);
    INSERT INTO Tools (Name) VALUES ('Drill'), ('Ladder'), ('Saw');
    INSERT INTO Loans (ToolId, Borrower, ReturnedOn) VALUES (1, 'Ada', NULL), (3, 'Grace', '2026-03-01');
    """);

Show("JOIN (only tools with a loan)",
    "SELECT Tools.Name, Loans.Borrower FROM Tools JOIN Loans ON Loans.ToolId = Tools.Id ORDER BY Tools.Name");
Show("LEFT JOIN, open loans in ON (every tool, with its open loan if any)",
    "SELECT Tools.Name, Loans.Borrower FROM Tools LEFT JOIN Loans ON Loans.ToolId = Tools.Id AND Loans.ReturnedOn IS NULL ORDER BY Tools.Name");
Show("LEFT JOIN, open loans in WHERE (the mistake)",
    "SELECT Tools.Name, Loans.Borrower FROM Tools LEFT JOIN Loans ON Loans.ToolId = Tools.Id WHERE Loans.ReturnedOn IS NULL ORDER BY Tools.Name");

void Run(string sql)
{
    var command = connection.CreateCommand();
    command.CommandText = sql;
    command.ExecuteNonQuery();
}

void Show(string title, string sql)
{
    var command = connection.CreateCommand();
    command.CommandText = sql;
    using var reader = command.ExecuteReader();
    var rows = new List<string>();
    while (reader.Read())
        rows.Add($"{reader.GetString(0)}: {(reader.IsDBNull(1) ? "available" : "lent to " + reader.GetString(1))}");
    Console.WriteLine($"{title}\n   {string.Join("\n   ", rows)}");
}
```

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
    <PackageReference Include="Microsoft.Data.Sqlite" Version="9.0.20" />
  </ItemGroup>

</Project>
```

A `"""` **raw string literal** (C# 11) spans several lines and needs no escaping, which suits SQL. The output:

```text
JOIN (only tools with a loan)
   Drill: lent to Ada
   Saw: lent to Grace
LEFT JOIN, open loans in ON (every tool, with its open loan if any)
   Drill: lent to Ada
   Ladder: available
   Saw: available
LEFT JOIN, open loans in WHERE (the mistake)
   Drill: lent to Ada
   Ladder: available
```

- The plain `JOIN` dropped the Ladder (it has no loans) and still showed the Saw as lent to Grace, though she returned it.
- The `LEFT JOIN` with **`AND Loans.ReturnedOn IS NULL` in the `ON` clause** is right: only *open* loans match, and tools without one appear as available.
- Moving that condition to **`WHERE`** made the **Saw disappear**. The left join paired the Saw with Grace's returned loan; `WHERE` then removed that combined row, and with it the tool. Conditions about the right-hand table of a `LEFT JOIN` belong in `ON`.

Dates are stored as text in the ISO format, `2026-03-16`, which sorts and compares correctly as text: an earlier date is always a smaller string.

## Challenge: library_repository

The repository is split into two files of one `partial class` (level 11): the given half (read-only) creates the schema, adds tools and reads loans; write the other half in `SqliteLibraryRepository.cs`:

- **`SearchAsync(text)`**: every tool whose name **or** category contains `text` (`LIKE`, which ignores case for English letters), **ordered by name**, each with its **open** loan's `Borrower` and `DueOn`, or `null`s when it's available. Tools with only returned loans must still appear, as available.
- **`GetOpenLoanAsync(toolId)`**: the tool's open loan, or `null`.
- **`AddLoanAsync(toolId, borrower, lentOn, dueOn)`**: records a loan and returns its new `Id`.
- **`CloseLoanAsync(loanId, returnedOn)`**: sets the loan's `ReturnedOn`.

Use parameters for every value (level 34). `ReadLoans(command)` and `Text(date)` in the given half read loans and format dates; `$pattern` set to `"%" + text + "%"` makes `LIKE $pattern` mean "contains".

```challenge console file=SqliteLibraryRepository.cs
using Microsoft.Data.Sqlite;

namespace LessonApp;

public partial class SqliteLibraryRepository
{
    public Task<IReadOnlyList<ToolStatus>> SearchAsync(string text) =>
        Task.FromResult<IReadOnlyList<ToolStatus>>(new List<ToolStatus>());   // TODO

    public Task<Loan?> GetOpenLoanAsync(long toolId) => Task.FromResult<Loan?>(null);   // TODO

    public Task<long> AddLoanAsync(long toolId, string borrower, DateOnly lentOn, DateOnly dueOn) => Task.FromResult(0L);   // TODO

    public Task CloseLoanAsync(long loanId, DateOnly returnedOn) => Task.CompletedTask;   // TODO
}
```

```challenge console file=SqliteLibraryRepository.Schema.cs readonly
using Microsoft.Data.Sqlite;

namespace LessonApp;

// The repository's given half: the schema, adding tools, and reading rows.
public partial class SqliteLibraryRepository : ILibraryRepository
{
    private readonly SqliteConnection connection;

    public SqliteLibraryRepository(SqliteConnection connection) => this.connection = connection;

    public async Task CreateSchemaAsync()
    {
        var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE IF NOT EXISTS Tools (
                Id INTEGER PRIMARY KEY,
                Name TEXT NOT NULL UNIQUE,
                Category TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS Loans (
                Id INTEGER PRIMARY KEY,
                ToolId INTEGER NOT NULL REFERENCES Tools(Id),
                Borrower TEXT NOT NULL,
                LentOn TEXT NOT NULL,
                DueOn TEXT NOT NULL,
                ReturnedOn TEXT NULL);
            """;
        await command.ExecuteNonQueryAsync();
    }

    public async Task<long> AddToolAsync(string name, string category)
    {
        var command = connection.CreateCommand();
        command.CommandText = "INSERT INTO Tools (Name, Category) VALUES ($name, $category) RETURNING Id";
        command.Parameters.AddWithValue("$name", name);
        command.Parameters.AddWithValue("$category", category);
        return Convert.ToInt64(await command.ExecuteScalarAsync());
    }

    public async Task<IReadOnlyList<Loan>> GetOpenLoansAsync()
    {
        var command = connection.CreateCommand();
        command.CommandText = "SELECT Id, ToolId, Borrower, LentOn, DueOn, ReturnedOn FROM Loans WHERE ReturnedOn IS NULL ORDER BY DueOn";
        return await ReadLoans(command);
    }

    private static async Task<List<Loan>> ReadLoans(SqliteCommand command)
    {
        var loans = new List<Loan>();
        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            loans.Add(new Loan(
                reader.GetInt64(0), reader.GetInt64(1), reader.GetString(2),
                DateOnly.Parse(reader.GetString(3)), DateOnly.Parse(reader.GetString(4)),
                reader.IsDBNull(5) ? null : DateOnly.Parse(reader.GetString(5))));
        }
        return loans;
    }

    // Dates are stored as ISO text, "2026-03-09", which sorts and compares correctly as text.
    private static string Text(DateOnly date) => date.ToString("yyyy-MM-dd");
}
```

```challenge console file=Library.cs readonly
namespace LessonApp;

// A tool, as the screen shows it: with the borrower and due date of its open loan, if any.
public record ToolStatus(long Id, string Name, string Category, string? Borrower, DateOnly? DueOn)
{
    public bool IsAvailable => Borrower == null;
}

public record Loan(long Id, long ToolId, string Borrower, DateOnly LentOn, DateOnly DueOn, DateOnly? ReturnedOn);

public interface ILibraryRepository
{
    Task CreateSchemaAsync();
    Task<long> AddToolAsync(string name, string category);
    Task<IReadOnlyList<ToolStatus>> SearchAsync(string text);
    Task<Loan?> GetOpenLoanAsync(long toolId);
    Task<long> AddLoanAsync(long toolId, string borrower, DateOnly lentOn, DateOnly dueOn);
    Task CloseLoanAsync(long loanId, DateOnly returnedOn);
    Task<IReadOnlyList<Loan>> GetOpenLoansAsync();
}

public interface IClock
{
    DateOnly Today { get; }
}

public class SystemClock : IClock
{
    public DateOnly Today => DateOnly.FromDateTime(DateTime.Today);
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
    <PackageReference Include="Microsoft.Data.Sqlite" Version="9.0.20" />
  </ItemGroup>

</Project>
```

```test
var connection = new Microsoft.Data.Sqlite.SqliteConnection("Data Source=:memory:"); connection.Open();
var library = new SqliteLibraryRepository(connection); library.CreateSchemaAsync().GetAwaiter().GetResult();
var drill = library.AddToolAsync("Drill", "Power tools").GetAwaiter().GetResult(); library.AddToolAsync("Saw", "Hand tools").GetAwaiter().GetResult(); library.AddToolAsync("Sander", "Power tools").GetAwaiter().GetResult();
assert string.Join(",", library.SearchAsync("").GetAwaiter().GetResult().Select(t => t.Name + (t.IsAvailable ? "" : "*"))) == "Drill,Sander,Saw"   // everything, by name, all available
assert string.Join(",", library.SearchAsync("POWER").GetAwaiter().GetResult().Select(t => t.Name)) == "Drill,Sander"   // matched by category, ignoring case
var loanId = library.AddLoanAsync(drill, "Ada", new DateOnly(2026, 3, 9), new DateOnly(2026, 3, 16)).GetAwaiter().GetResult();
assert loanId > 0 && library.GetOpenLoanAsync(drill).GetAwaiter().GetResult() == new Loan(loanId, drill, "Ada", new DateOnly(2026, 3, 9), new DateOnly(2026, 3, 16), null) && library.SearchAsync("drill").GetAwaiter().GetResult().Single() == new ToolStatus(drill, "Drill", "Power tools", "Ada", new DateOnly(2026, 3, 16))
library.CloseLoanAsync(loanId, new DateOnly(2026, 3, 12)).GetAwaiter().GetResult();
assert library.GetOpenLoanAsync(drill).GetAwaiter().GetResult() == null && library.GetOpenLoansAsync().GetAwaiter().GetResult().Count == 0   // returned
assert library.SearchAsync("drill").GetAwaiter().GetResult().SingleOrDefault() is { IsAvailable: true }   // a tool with only a returned loan is still listed, as available
assert library.SearchAsync("x' OR '1'='1").GetAwaiter().GetResult().Count == 0   // parameters, not concatenation
```

## Challenge: lending_rules

Write **`LendingService`** in `LendingService.cs`, the rules of the library, on top of an `ILibraryRepository` and an `IClock` (both given to the constructor):

- **`LendAsync(toolId, borrower)`**: returns `LendResult.NoBorrower` (and lends nothing) for an empty or blank borrower; `LendResult.AlreadyOnLoan` if the tool has an open loan; otherwise records a loan to the **trimmed** borrower name, lent **today**, due **7 days** later (`LoanDays`), and returns `LendResult.Lent`.
- **`ReturnAsync(toolId)`**: closes the tool's open loan as returned **today** and returns `true`, or returns `false` if the tool isn't on loan.
- **`GetOverdueAsync()`**: the open loans whose due date is **before** today. A loan due today is not yet overdue.

Keep the methods `virtual` and the two `protected` properties: the next step needs them. The tests use the in-memory fakes from `Fakes.cs`.

```challenge console file=LendingService.cs
namespace LessonApp;

public enum LendResult { Lent, NoBorrower, AlreadyOnLoan }

public class LendingService
{
    public const int LoanDays = 7;

    public LendingService(ILibraryRepository repository, IClock clock)
    {
        Repository = repository;
        Clock = clock;
    }

    protected ILibraryRepository Repository { get; }
    protected IClock Clock { get; }

    public virtual Task<LendResult> LendAsync(long toolId, string borrower) => Task.FromResult(LendResult.Lent);   // TODO

    public virtual Task<bool> ReturnAsync(long toolId) => Task.FromResult(false);   // TODO

    public virtual Task<IReadOnlyList<Loan>> GetOverdueAsync() => Task.FromResult<IReadOnlyList<Loan>>(new List<Loan>());   // TODO
}
```

```challenge console file=Fakes.cs readonly
namespace LessonApp;

// An in-memory repository and a settable clock, for testing without a database or a calendar.
public class FakeLibraryRepository : ILibraryRepository
{
    private readonly List<(long Id, string Name, string Category)> tools = new();
    public List<Loan> Loans { get; } = new();

    public Task CreateSchemaAsync() => Task.CompletedTask;

    public Task<long> AddToolAsync(string name, string category)
    {
        long id = tools.Count + 1;
        tools.Add((id, name, category));
        return Task.FromResult(id);
    }

    public Task<IReadOnlyList<ToolStatus>> SearchAsync(string text)
    {
        IReadOnlyList<ToolStatus> found = tools
            .Where(tool => tool.Name.Contains(text, StringComparison.OrdinalIgnoreCase) || tool.Category.Contains(text, StringComparison.OrdinalIgnoreCase))
            .OrderBy(tool => tool.Name)
            .Select(tool =>
            {
                Loan? open = Loans.FirstOrDefault(loan => loan.ToolId == tool.Id && loan.ReturnedOn == null);
                return new ToolStatus(tool.Id, tool.Name, tool.Category, open?.Borrower, open?.DueOn);
            })
            .ToList();
        return Task.FromResult(found);
    }

    public Task<Loan?> GetOpenLoanAsync(long toolId) =>
        Task.FromResult(Loans.FirstOrDefault(loan => loan.ToolId == toolId && loan.ReturnedOn == null));

    public Task<long> AddLoanAsync(long toolId, string borrower, DateOnly lentOn, DateOnly dueOn)
    {
        long id = Loans.Count + 1;
        Loans.Add(new Loan(id, toolId, borrower, lentOn, dueOn, null));
        return Task.FromResult(id);
    }

    public Task CloseLoanAsync(long loanId, DateOnly returnedOn)
    {
        int index = Loans.FindIndex(loan => loan.Id == loanId);
        Loans[index] = Loans[index] with { ReturnedOn = returnedOn };
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<Loan>> GetOpenLoansAsync() =>
        Task.FromResult<IReadOnlyList<Loan>>(Loans.Where(loan => loan.ReturnedOn == null).OrderBy(loan => loan.DueOn).ToList());
}

public class FakeClock : IClock
{
    public DateOnly Today { get; set; } = new DateOnly(2026, 3, 9);
}
```

```challenge console file=Library.cs readonly
namespace LessonApp;

// A tool, as the screen shows it: with the borrower and due date of its open loan, if any.
public record ToolStatus(long Id, string Name, string Category, string? Borrower, DateOnly? DueOn)
{
    public bool IsAvailable => Borrower == null;
}

public record Loan(long Id, long ToolId, string Borrower, DateOnly LentOn, DateOnly DueOn, DateOnly? ReturnedOn);

public interface ILibraryRepository
{
    Task CreateSchemaAsync();
    Task<long> AddToolAsync(string name, string category);
    Task<IReadOnlyList<ToolStatus>> SearchAsync(string text);
    Task<Loan?> GetOpenLoanAsync(long toolId);
    Task<long> AddLoanAsync(long toolId, string borrower, DateOnly lentOn, DateOnly dueOn);
    Task CloseLoanAsync(long loanId, DateOnly returnedOn);
    Task<IReadOnlyList<Loan>> GetOpenLoansAsync();
}

public interface IClock
{
    DateOnly Today { get; }
}

public class SystemClock : IClock
{
    public DateOnly Today => DateOnly.FromDateTime(DateTime.Today);
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
var repository = new FakeLibraryRepository(); var clock = new FakeClock { Today = new DateOnly(2026, 3, 9) };
var lending = new LendingService(repository, clock);
var drill = repository.AddToolAsync("Drill", "Power tools").GetAwaiter().GetResult(); var saw = repository.AddToolAsync("Saw", "Hand tools").GetAwaiter().GetResult();
assert lending.LendAsync(drill, "   ").GetAwaiter().GetResult() == LendResult.NoBorrower && repository.Loans.Count == 0   // no borrower, no loan
assert lending.LendAsync(drill, " Ada ").GetAwaiter().GetResult() == LendResult.Lent && repository.Loans.Single() is { Borrower: "Ada", LentOn: var lent, DueOn: var due } && lent == new DateOnly(2026, 3, 9) && due == new DateOnly(2026, 3, 16)   // trimmed, today, due in seven days
assert lending.LendAsync(drill, "Grace").GetAwaiter().GetResult() == LendResult.AlreadyOnLoan && repository.Loans.Count == 1
lending.LendAsync(saw, "Linus").GetAwaiter().GetResult(); clock.Today = new DateOnly(2026, 3, 16);
assert lending.GetOverdueAsync().GetAwaiter().GetResult().Count == 0   // due today is not overdue yet
clock.Today = new DateOnly(2026, 3, 17);
assert lending.GetOverdueAsync().GetAwaiter().GetResult().Count == 2 && lending.ReturnAsync(drill).GetAwaiter().GetResult() && repository.Loans.First(l => l.ToolId == drill).ReturnedOn == new DateOnly(2026, 3, 17) && lending.GetOverdueAsync().GetAwaiter().GetResult().Single().ToolId == saw   // returned today, no longer overdue
assert !lending.ReturnAsync(drill).GetAwaiter().GetResult() && lending.LendAsync(drill, "Grace").GetAwaiter().GetResult() == LendResult.Lent   // nothing to return twice; and it can be lent again
```

## Challenge: lending_tests

Now test the rules yourself, as level 31 taught: in **`LendingTests.cs`**, write at least **four** xUnit tests of `LendingService`, each creating it with **`Subject.Create(repository, clock)`** and using the fakes. Your tests must pass against the real service (given, read-only), and between them must catch **four** hidden mutants, each breaking one rule from the last challenge: the length of a loan, lending a tool that's already out, returning, and when a loan becomes overdue.

`Assert.Empty(collection)` and `Assert.Single(collection)` check for zero and exactly one item. A test method can be `async Task` and `await` the service.

```challenge console file=LendingTests.cs
using Xunit;

namespace LessonApp;

public class LendingTests
{
    // TODO: at least four tests, each creating the service with Subject.Create(repository, clock)
}
```

```challenge console file=LendingService.cs readonly
namespace LessonApp;

public enum LendResult { Lent, NoBorrower, AlreadyOnLoan }

public class LendingService
{
    public const int LoanDays = 7;

    public LendingService(ILibraryRepository repository, IClock clock)
    {
        Repository = repository;
        Clock = clock;
    }

    protected ILibraryRepository Repository { get; }
    protected IClock Clock { get; }

    public virtual async Task<LendResult> LendAsync(long toolId, string borrower)
    {
        if (string.IsNullOrWhiteSpace(borrower)) return LendResult.NoBorrower;
        if (await Repository.GetOpenLoanAsync(toolId) != null) return LendResult.AlreadyOnLoan;
        DateOnly today = Clock.Today;
        await Repository.AddLoanAsync(toolId, borrower.Trim(), today, today.AddDays(LoanDays));
        return LendResult.Lent;
    }

    public virtual async Task<bool> ReturnAsync(long toolId)
    {
        Loan? loan = await Repository.GetOpenLoanAsync(toolId);
        if (loan == null) return false;
        await Repository.CloseLoanAsync(loan.Id, Clock.Today);
        return true;
    }

    public virtual async Task<IReadOnlyList<Loan>> GetOverdueAsync()
    {
        DateOnly today = Clock.Today;
        return (await Repository.GetOpenLoansAsync()).Where(loan => loan.DueOn < today).ToList();
    }
}
```

```challenge console file=Mutants.cs readonly
namespace LessonApp;

// Your tests create the service here, so the checker can swap in a broken one.
public static class Subject
{
    public static Func<ILibraryRepository, IClock, LendingService> Create = (repository, clock) => new LendingService(repository, clock);
}

// Four realistic bugs, one per class, each overriding one method of the real service.
public class DueInSixDays : LendingService
{
    public DueInSixDays(ILibraryRepository repository, IClock clock) : base(repository, clock) { }

    public override async Task<LendResult> LendAsync(long toolId, string borrower)
    {
        if (string.IsNullOrWhiteSpace(borrower)) return LendResult.NoBorrower;
        if (await Repository.GetOpenLoanAsync(toolId) != null) return LendResult.AlreadyOnLoan;
        await Repository.AddLoanAsync(toolId, borrower.Trim(), Clock.Today, Clock.Today.AddDays(6));
        return LendResult.Lent;
    }
}

public class LendsTwice : LendingService
{
    public LendsTwice(ILibraryRepository repository, IClock clock) : base(repository, clock) { }

    public override async Task<LendResult> LendAsync(long toolId, string borrower)
    {
        if (string.IsNullOrWhiteSpace(borrower)) return LendResult.NoBorrower;
        await Repository.AddLoanAsync(toolId, borrower.Trim(), Clock.Today, Clock.Today.AddDays(LoanDays));
        return LendResult.Lent;
    }
}

public class ReturnForgets : LendingService
{
    public ReturnForgets(ILibraryRepository repository, IClock clock) : base(repository, clock) { }

    public override async Task<bool> ReturnAsync(long toolId) => await Repository.GetOpenLoanAsync(toolId) != null;
}

public class OverdueOnTheDueDay : LendingService
{
    public OverdueOnTheDueDay(ILibraryRepository repository, IClock clock) : base(repository, clock) { }

    public override async Task<IReadOnlyList<Loan>> GetOverdueAsync() =>
        (await Repository.GetOpenLoansAsync()).Where(loan => loan.DueOn <= Clock.Today).ToList();
}
```

```challenge console file=TestChecker.cs readonly
using System.Reflection;
using Xunit;

namespace LessonApp;

// Runs a class's [Fact] and [Theory] tests the way xUnit's runner does: a new instance of the
// class per test, one run per [InlineData], awaiting async tests. Returns the failures.
public static class TestChecker
{
    public static int CountTests(Type testClass) =>
        testClass.GetMethods().Sum(method => method.GetCustomAttribute<FactAttribute>() == null ? 0 : Math.Max(1, method.GetCustomAttributes<InlineDataAttribute>().Count()));

    public static List<string> Failures(Type testClass)
    {
        var failures = new List<string>();
        foreach (MethodInfo method in testClass.GetMethods())
        {
            if (method.GetCustomAttribute<FactAttribute>() == null) continue;   // [Theory] is a kind of [Fact]
            var cases = method.GetCustomAttributes<InlineDataAttribute>().Select(data => data.Data).ToList();
            if (cases.Count == 0) cases.Add(Array.Empty<object?>());
            foreach (object?[] arguments in cases)
            {
                try
                {
                    object? result = method.Invoke(Activator.CreateInstance(testClass), arguments);
                    if (result is Task task) task.GetAwaiter().GetResult();
                }
                catch (Exception error)
                {
                    var cause = error is TargetInvocationException { InnerException: { } inner } ? inner : error;
                    failures.Add($"{method.Name}: {cause.Message.Split('\n')[0]}");
                }
            }
        }
        return failures;
    }
}
```

```challenge console file=Fakes.cs readonly
namespace LessonApp;

// An in-memory repository and a settable clock, for testing without a database or a calendar.
public class FakeLibraryRepository : ILibraryRepository
{
    private readonly List<(long Id, string Name, string Category)> tools = new();
    public List<Loan> Loans { get; } = new();

    public Task CreateSchemaAsync() => Task.CompletedTask;

    public Task<long> AddToolAsync(string name, string category)
    {
        long id = tools.Count + 1;
        tools.Add((id, name, category));
        return Task.FromResult(id);
    }

    public Task<IReadOnlyList<ToolStatus>> SearchAsync(string text)
    {
        IReadOnlyList<ToolStatus> found = tools
            .Where(tool => tool.Name.Contains(text, StringComparison.OrdinalIgnoreCase) || tool.Category.Contains(text, StringComparison.OrdinalIgnoreCase))
            .OrderBy(tool => tool.Name)
            .Select(tool =>
            {
                Loan? open = Loans.FirstOrDefault(loan => loan.ToolId == tool.Id && loan.ReturnedOn == null);
                return new ToolStatus(tool.Id, tool.Name, tool.Category, open?.Borrower, open?.DueOn);
            })
            .ToList();
        return Task.FromResult(found);
    }

    public Task<Loan?> GetOpenLoanAsync(long toolId) =>
        Task.FromResult(Loans.FirstOrDefault(loan => loan.ToolId == toolId && loan.ReturnedOn == null));

    public Task<long> AddLoanAsync(long toolId, string borrower, DateOnly lentOn, DateOnly dueOn)
    {
        long id = Loans.Count + 1;
        Loans.Add(new Loan(id, toolId, borrower, lentOn, dueOn, null));
        return Task.FromResult(id);
    }

    public Task CloseLoanAsync(long loanId, DateOnly returnedOn)
    {
        int index = Loans.FindIndex(loan => loan.Id == loanId);
        Loans[index] = Loans[index] with { ReturnedOn = returnedOn };
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<Loan>> GetOpenLoansAsync() =>
        Task.FromResult<IReadOnlyList<Loan>>(Loans.Where(loan => loan.ReturnedOn == null).OrderBy(loan => loan.DueOn).ToList());
}

public class FakeClock : IClock
{
    public DateOnly Today { get; set; } = new DateOnly(2026, 3, 9);
}
```

```challenge console file=Library.cs readonly
namespace LessonApp;

// A tool, as the screen shows it: with the borrower and due date of its open loan, if any.
public record ToolStatus(long Id, string Name, string Category, string? Borrower, DateOnly? DueOn)
{
    public bool IsAvailable => Borrower == null;
}

public record Loan(long Id, long ToolId, string Borrower, DateOnly LentOn, DateOnly DueOn, DateOnly? ReturnedOn);

public interface ILibraryRepository
{
    Task CreateSchemaAsync();
    Task<long> AddToolAsync(string name, string category);
    Task<IReadOnlyList<ToolStatus>> SearchAsync(string text);
    Task<Loan?> GetOpenLoanAsync(long toolId);
    Task<long> AddLoanAsync(long toolId, string borrower, DateOnly lentOn, DateOnly dueOn);
    Task CloseLoanAsync(long loanId, DateOnly returnedOn);
    Task<IReadOnlyList<Loan>> GetOpenLoansAsync();
}

public interface IClock
{
    DateOnly Today { get; }
}

public class SystemClock : IClock
{
    public DateOnly Today => DateOnly.FromDateTime(DateTime.Today);
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
    <XunitAutoGeneratedEntryPoint>false</XunitAutoGeneratedEntryPoint>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="CommunityToolkit.Mvvm" Version="8.4.0" />
    <PackageReference Include="xunit.v3" Version="3.2.2" />
  </ItemGroup>

</Project>
```

```test
assert TestChecker.CountTests(typeof(LendingTests)) >= 4
assert TestChecker.Failures(typeof(LendingTests)).Count == 0   // they all pass against the real service
Subject.Create = (repository, clock) => new DueInSixDays(repository, clock);
assert TestChecker.Failures(typeof(LendingTests)).Count > 0   // caught: the loan length
Subject.Create = (repository, clock) => new LendsTwice(repository, clock);
assert TestChecker.Failures(typeof(LendingTests)).Count > 0   // caught: lending a tool that's already out
Subject.Create = (repository, clock) => new ReturnForgets(repository, clock);
assert TestChecker.Failures(typeof(LendingTests)).Count > 0   // caught: a return that closes nothing
Subject.Create = (repository, clock) => new OverdueOnTheDueDay(repository, clock);
assert TestChecker.Failures(typeof(LendingTests)).Count > 0   // caught: overdue one day early
```

## Challenge: library_screen

Write **`LibraryViewModel`** in `LibraryViewModel.cs`, the screen's view model, with the toolkit (level 26). It receives the `LendingService` and the `ILibraryRepository`:

- **`LoadCommand`** (an `async Task LoadAsync()`) fills `Tools` with the repository's search for `SearchText`, and keeps the same tool selected (by `Id`) if it's still in the list.
- **`LendCommand`** can execute only when the selected tool is **available** and **`BorrowerName`** isn't blank; it lends the tool to `BorrowerName`, sets **`Status`** to `Lent <tool> to <borrower>.` (the borrower trimmed), clears `BorrowerName`, and reloads.
- **`ReturnCommand`** can execute only when the selected tool is **on loan**; it returns it, sets `Status` to `<tool> returned.`, and reloads.
- Both commands' `CanExecute` must update when `SelectedTool` or `BorrowerName` changes.

`[NotifyCanExecuteChangedFor(nameof(LendCommand), nameof(ReturnCommand))]` refreshes two commands at once.

```challenge console file=LibraryViewModel.cs
using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace LessonApp;

public partial class LibraryViewModel : ObservableObject
{
    private readonly LendingService lending;
    private readonly ILibraryRepository repository;

    public LibraryViewModel(LendingService lending, ILibraryRepository repository)
    {
        this.lending = lending;
        this.repository = repository;
    }

    public ObservableCollection<ToolStatus> Tools { get; } = new();

    [ObservableProperty]
    private string searchText = "";

    [ObservableProperty]
    private ToolStatus? selectedTool;

    [ObservableProperty]
    private string borrowerName = "";

    [ObservableProperty]
    private string status = "";

    [RelayCommand]
    private Task LoadAsync() => Task.CompletedTask;   // TODO

    [RelayCommand]
    private Task LendAsync() => Task.CompletedTask;   // TODO

    [RelayCommand]
    private Task ReturnAsync() => Task.CompletedTask;   // TODO
}
```

```challenge console file=LendingService.cs readonly
namespace LessonApp;

public enum LendResult { Lent, NoBorrower, AlreadyOnLoan }

public class LendingService
{
    public const int LoanDays = 7;

    public LendingService(ILibraryRepository repository, IClock clock)
    {
        Repository = repository;
        Clock = clock;
    }

    protected ILibraryRepository Repository { get; }
    protected IClock Clock { get; }

    public virtual async Task<LendResult> LendAsync(long toolId, string borrower)
    {
        if (string.IsNullOrWhiteSpace(borrower)) return LendResult.NoBorrower;
        if (await Repository.GetOpenLoanAsync(toolId) != null) return LendResult.AlreadyOnLoan;
        DateOnly today = Clock.Today;
        await Repository.AddLoanAsync(toolId, borrower.Trim(), today, today.AddDays(LoanDays));
        return LendResult.Lent;
    }

    public virtual async Task<bool> ReturnAsync(long toolId)
    {
        Loan? loan = await Repository.GetOpenLoanAsync(toolId);
        if (loan == null) return false;
        await Repository.CloseLoanAsync(loan.Id, Clock.Today);
        return true;
    }

    public virtual async Task<IReadOnlyList<Loan>> GetOverdueAsync()
    {
        DateOnly today = Clock.Today;
        return (await Repository.GetOpenLoansAsync()).Where(loan => loan.DueOn < today).ToList();
    }
}
```

```challenge console file=Fakes.cs readonly
namespace LessonApp;

// An in-memory repository and a settable clock, for testing without a database or a calendar.
public class FakeLibraryRepository : ILibraryRepository
{
    private readonly List<(long Id, string Name, string Category)> tools = new();
    public List<Loan> Loans { get; } = new();

    public Task CreateSchemaAsync() => Task.CompletedTask;

    public Task<long> AddToolAsync(string name, string category)
    {
        long id = tools.Count + 1;
        tools.Add((id, name, category));
        return Task.FromResult(id);
    }

    public Task<IReadOnlyList<ToolStatus>> SearchAsync(string text)
    {
        IReadOnlyList<ToolStatus> found = tools
            .Where(tool => tool.Name.Contains(text, StringComparison.OrdinalIgnoreCase) || tool.Category.Contains(text, StringComparison.OrdinalIgnoreCase))
            .OrderBy(tool => tool.Name)
            .Select(tool =>
            {
                Loan? open = Loans.FirstOrDefault(loan => loan.ToolId == tool.Id && loan.ReturnedOn == null);
                return new ToolStatus(tool.Id, tool.Name, tool.Category, open?.Borrower, open?.DueOn);
            })
            .ToList();
        return Task.FromResult(found);
    }

    public Task<Loan?> GetOpenLoanAsync(long toolId) =>
        Task.FromResult(Loans.FirstOrDefault(loan => loan.ToolId == toolId && loan.ReturnedOn == null));

    public Task<long> AddLoanAsync(long toolId, string borrower, DateOnly lentOn, DateOnly dueOn)
    {
        long id = Loans.Count + 1;
        Loans.Add(new Loan(id, toolId, borrower, lentOn, dueOn, null));
        return Task.FromResult(id);
    }

    public Task CloseLoanAsync(long loanId, DateOnly returnedOn)
    {
        int index = Loans.FindIndex(loan => loan.Id == loanId);
        Loans[index] = Loans[index] with { ReturnedOn = returnedOn };
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<Loan>> GetOpenLoansAsync() =>
        Task.FromResult<IReadOnlyList<Loan>>(Loans.Where(loan => loan.ReturnedOn == null).OrderBy(loan => loan.DueOn).ToList());
}

public class FakeClock : IClock
{
    public DateOnly Today { get; set; } = new DateOnly(2026, 3, 9);
}
```

```challenge console file=Library.cs readonly
namespace LessonApp;

// A tool, as the screen shows it: with the borrower and due date of its open loan, if any.
public record ToolStatus(long Id, string Name, string Category, string? Borrower, DateOnly? DueOn)
{
    public bool IsAvailable => Borrower == null;
}

public record Loan(long Id, long ToolId, string Borrower, DateOnly LentOn, DateOnly DueOn, DateOnly? ReturnedOn);

public interface ILibraryRepository
{
    Task CreateSchemaAsync();
    Task<long> AddToolAsync(string name, string category);
    Task<IReadOnlyList<ToolStatus>> SearchAsync(string text);
    Task<Loan?> GetOpenLoanAsync(long toolId);
    Task<long> AddLoanAsync(long toolId, string borrower, DateOnly lentOn, DateOnly dueOn);
    Task CloseLoanAsync(long loanId, DateOnly returnedOn);
    Task<IReadOnlyList<Loan>> GetOpenLoansAsync();
}

public interface IClock
{
    DateOnly Today { get; }
}

public class SystemClock : IClock
{
    public DateOnly Today => DateOnly.FromDateTime(DateTime.Today);
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
var repository = new FakeLibraryRepository(); var clock = new FakeClock();
repository.AddToolAsync("Saw", "Hand tools").GetAwaiter().GetResult(); repository.AddToolAsync("Drill", "Power tools").GetAwaiter().GetResult(); repository.AddToolAsync("Sander", "Power tools").GetAwaiter().GetResult();
var screen = new LibraryViewModel(new LendingService(repository, clock), repository);
screen.LoadCommand.ExecuteAsync(null).GetAwaiter().GetResult();
assert string.Join(",", screen.Tools.Select(t => t.Name)) == "Drill,Sander,Saw"
screen.SelectedTool = screen.Tools[0]; var refreshed = 0; screen.LendCommand.CanExecuteChanged += (_, _) => refreshed++;
assert !screen.LendCommand.CanExecute(null) && !screen.ReturnCommand.CanExecute(null)   // a tool, but no borrower yet; nothing to return
screen.BorrowerName = " Ada ";
assert screen.LendCommand.CanExecute(null) && refreshed > 0   // and the button was told
screen.LendCommand.ExecuteAsync(null).GetAwaiter().GetResult();
assert screen.Status == "Lent Drill to Ada." && screen.BorrowerName == "" && screen.Tools[0].Borrower == "Ada" && screen.SelectedTool?.Name == "Drill" && screen.ReturnCommand.CanExecute(null) && !screen.LendCommand.CanExecute(null)   // reloaded, still selected
screen.ReturnCommand.ExecuteAsync(null).GetAwaiter().GetResult();
assert screen.Status == "Drill returned." && screen.Tools[0].IsAvailable && !screen.ReturnCommand.CanExecute(null)
screen.SearchText = "power"; screen.LoadCommand.ExecuteAsync(null).GetAwaiter().GetResult();
assert string.Join(",", screen.Tools.Select(t => t.Name)) == "Drill,Sander" && screen.SelectedTool?.Name == "Drill"   // searched, selection kept
```

## Challenge: composition

Finally the composition root (level 28). Write **`AppHost.Build(string databasePath)`** in `AppHost.cs`, returning an `IHost` built with `Host.CreateApplicationBuilder()` whose services provide:

- one **`SqliteConnection`** for the whole app, opened on the database file at `databasePath`;
- **`ILibraryRepository`** as one shared `SqliteLibraryRepository`;
- **`IClock`** as one shared `SystemClock`;
- a **new** `LendingService` and a **new** `LibraryViewModel` each time they're asked for.

`AddSingleton(provider => ...)` registers a singleton made by your own function, called the first time it's needed.

```challenge console file=AppHost.cs
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace LessonApp;

public static class AppHost
{
    public static IHost Build(string databasePath)
    {
        var builder = Host.CreateApplicationBuilder();
        // TODO: register the services
        return builder.Build();
    }
}
```

```challenge console file=LibraryViewModel.cs readonly
using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace LessonApp;

public partial class LibraryViewModel : ObservableObject
{
    private readonly LendingService lending;
    private readonly ILibraryRepository repository;

    public LibraryViewModel(LendingService lending, ILibraryRepository repository)
    {
        this.lending = lending;
        this.repository = repository;
    }

    public ObservableCollection<ToolStatus> Tools { get; } = new();

    [ObservableProperty]
    private string searchText = "";

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(LendCommand), nameof(ReturnCommand))]
    private ToolStatus? selectedTool;

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(LendCommand))]
    private string borrowerName = "";

    [ObservableProperty]
    private string status = "";

    [RelayCommand]
    private async Task LoadAsync()
    {
        long? selectedId = SelectedTool?.Id;
        Tools.Clear();
        foreach (ToolStatus tool in await repository.SearchAsync(SearchText))
            Tools.Add(tool);
        SelectedTool = Tools.FirstOrDefault(tool => tool.Id == selectedId);
    }

    private bool CanLend() => SelectedTool is { IsAvailable: true } && !string.IsNullOrWhiteSpace(BorrowerName);

    [RelayCommand(CanExecute = nameof(CanLend))]
    private async Task LendAsync()
    {
        ToolStatus tool = SelectedTool!;
        LendResult result = await lending.LendAsync(tool.Id, BorrowerName);
        Status = result == LendResult.Lent ? $"Lent {tool.Name} to {BorrowerName.Trim()}." : $"Couldn't lend {tool.Name}: {result}.";
        BorrowerName = "";
        await LoadAsync();
    }

    private bool CanReturn() => SelectedTool is { IsAvailable: false };

    [RelayCommand(CanExecute = nameof(CanReturn))]
    private async Task ReturnAsync()
    {
        ToolStatus tool = SelectedTool!;
        await lending.ReturnAsync(tool.Id);
        Status = $"{tool.Name} returned.";
        await LoadAsync();
    }
}
```

```challenge console file=LendingService.cs readonly
namespace LessonApp;

public enum LendResult { Lent, NoBorrower, AlreadyOnLoan }

public class LendingService
{
    public const int LoanDays = 7;

    public LendingService(ILibraryRepository repository, IClock clock)
    {
        Repository = repository;
        Clock = clock;
    }

    protected ILibraryRepository Repository { get; }
    protected IClock Clock { get; }

    public virtual async Task<LendResult> LendAsync(long toolId, string borrower)
    {
        if (string.IsNullOrWhiteSpace(borrower)) return LendResult.NoBorrower;
        if (await Repository.GetOpenLoanAsync(toolId) != null) return LendResult.AlreadyOnLoan;
        DateOnly today = Clock.Today;
        await Repository.AddLoanAsync(toolId, borrower.Trim(), today, today.AddDays(LoanDays));
        return LendResult.Lent;
    }

    public virtual async Task<bool> ReturnAsync(long toolId)
    {
        Loan? loan = await Repository.GetOpenLoanAsync(toolId);
        if (loan == null) return false;
        await Repository.CloseLoanAsync(loan.Id, Clock.Today);
        return true;
    }

    public virtual async Task<IReadOnlyList<Loan>> GetOverdueAsync()
    {
        DateOnly today = Clock.Today;
        return (await Repository.GetOpenLoansAsync()).Where(loan => loan.DueOn < today).ToList();
    }
}
```

```challenge console file=SqliteLibraryRepository.cs readonly
using Microsoft.Data.Sqlite;

namespace LessonApp;

public partial class SqliteLibraryRepository
{
    public async Task<IReadOnlyList<ToolStatus>> SearchAsync(string text)
    {
        var command = connection.CreateCommand();
        command.CommandText = """
            SELECT Tools.Id, Tools.Name, Tools.Category, Loans.Borrower, Loans.DueOn
            FROM Tools
            LEFT JOIN Loans ON Loans.ToolId = Tools.Id AND Loans.ReturnedOn IS NULL
            WHERE Tools.Name LIKE $pattern OR Tools.Category LIKE $pattern
            ORDER BY Tools.Name
            """;
        command.Parameters.AddWithValue("$pattern", "%" + text + "%");
        var tools = new List<ToolStatus>();
        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            tools.Add(new ToolStatus(
                reader.GetInt64(0), reader.GetString(1), reader.GetString(2),
                reader.IsDBNull(3) ? null : reader.GetString(3),
                reader.IsDBNull(4) ? null : DateOnly.Parse(reader.GetString(4))));
        }
        return tools;
    }

    public async Task<Loan?> GetOpenLoanAsync(long toolId)
    {
        var command = connection.CreateCommand();
        command.CommandText = "SELECT Id, ToolId, Borrower, LentOn, DueOn, ReturnedOn FROM Loans WHERE ToolId = $toolId AND ReturnedOn IS NULL";
        command.Parameters.AddWithValue("$toolId", toolId);
        return (await ReadLoans(command)).FirstOrDefault();
    }

    public async Task<long> AddLoanAsync(long toolId, string borrower, DateOnly lentOn, DateOnly dueOn)
    {
        var command = connection.CreateCommand();
        command.CommandText = "INSERT INTO Loans (ToolId, Borrower, LentOn, DueOn) VALUES ($toolId, $borrower, $lentOn, $dueOn) RETURNING Id";
        command.Parameters.AddWithValue("$toolId", toolId);
        command.Parameters.AddWithValue("$borrower", borrower);
        command.Parameters.AddWithValue("$lentOn", Text(lentOn));
        command.Parameters.AddWithValue("$dueOn", Text(dueOn));
        return Convert.ToInt64(await command.ExecuteScalarAsync());
    }

    public async Task CloseLoanAsync(long loanId, DateOnly returnedOn)
    {
        var command = connection.CreateCommand();
        command.CommandText = "UPDATE Loans SET ReturnedOn = $returnedOn WHERE Id = $loanId";
        command.Parameters.AddWithValue("$returnedOn", Text(returnedOn));
        command.Parameters.AddWithValue("$loanId", loanId);
        await command.ExecuteNonQueryAsync();
    }
}
```

```challenge console file=SqliteLibraryRepository.Schema.cs readonly
using Microsoft.Data.Sqlite;

namespace LessonApp;

// The repository's given half: the schema, adding tools, and reading rows.
public partial class SqliteLibraryRepository : ILibraryRepository
{
    private readonly SqliteConnection connection;

    public SqliteLibraryRepository(SqliteConnection connection) => this.connection = connection;

    public async Task CreateSchemaAsync()
    {
        var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE IF NOT EXISTS Tools (
                Id INTEGER PRIMARY KEY,
                Name TEXT NOT NULL UNIQUE,
                Category TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS Loans (
                Id INTEGER PRIMARY KEY,
                ToolId INTEGER NOT NULL REFERENCES Tools(Id),
                Borrower TEXT NOT NULL,
                LentOn TEXT NOT NULL,
                DueOn TEXT NOT NULL,
                ReturnedOn TEXT NULL);
            """;
        await command.ExecuteNonQueryAsync();
    }

    public async Task<long> AddToolAsync(string name, string category)
    {
        var command = connection.CreateCommand();
        command.CommandText = "INSERT INTO Tools (Name, Category) VALUES ($name, $category) RETURNING Id";
        command.Parameters.AddWithValue("$name", name);
        command.Parameters.AddWithValue("$category", category);
        return Convert.ToInt64(await command.ExecuteScalarAsync());
    }

    public async Task<IReadOnlyList<Loan>> GetOpenLoansAsync()
    {
        var command = connection.CreateCommand();
        command.CommandText = "SELECT Id, ToolId, Borrower, LentOn, DueOn, ReturnedOn FROM Loans WHERE ReturnedOn IS NULL ORDER BY DueOn";
        return await ReadLoans(command);
    }

    private static async Task<List<Loan>> ReadLoans(SqliteCommand command)
    {
        var loans = new List<Loan>();
        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            loans.Add(new Loan(
                reader.GetInt64(0), reader.GetInt64(1), reader.GetString(2),
                DateOnly.Parse(reader.GetString(3)), DateOnly.Parse(reader.GetString(4)),
                reader.IsDBNull(5) ? null : DateOnly.Parse(reader.GetString(5))));
        }
        return loans;
    }

    // Dates are stored as ISO text, "2026-03-09", which sorts and compares correctly as text.
    private static string Text(DateOnly date) => date.ToString("yyyy-MM-dd");
}
```

```challenge console file=Library.cs readonly
namespace LessonApp;

// A tool, as the screen shows it: with the borrower and due date of its open loan, if any.
public record ToolStatus(long Id, string Name, string Category, string? Borrower, DateOnly? DueOn)
{
    public bool IsAvailable => Borrower == null;
}

public record Loan(long Id, long ToolId, string Borrower, DateOnly LentOn, DateOnly DueOn, DateOnly? ReturnedOn);

public interface ILibraryRepository
{
    Task CreateSchemaAsync();
    Task<long> AddToolAsync(string name, string category);
    Task<IReadOnlyList<ToolStatus>> SearchAsync(string text);
    Task<Loan?> GetOpenLoanAsync(long toolId);
    Task<long> AddLoanAsync(long toolId, string borrower, DateOnly lentOn, DateOnly dueOn);
    Task CloseLoanAsync(long loanId, DateOnly returnedOn);
    Task<IReadOnlyList<Loan>> GetOpenLoansAsync();
}

public interface IClock
{
    DateOnly Today { get; }
}

public class SystemClock : IClock
{
    public DateOnly Today => DateOnly.FromDateTime(DateTime.Today);
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
    <PackageReference Include="Microsoft.Data.Sqlite" Version="9.0.20" />
    <PackageReference Include="Microsoft.Extensions.Hosting" Version="9.0.0" />
  </ItemGroup>

</Project>
```

```test
var path = Path.Combine(Path.GetTempPath(), "tools-" + Guid.NewGuid().ToString("N") + ".db");
using var host = AppHost.Build(path);
var services = host.Services;
assert Microsoft.Extensions.DependencyInjection.ServiceProviderServiceExtensions.GetRequiredService<ILibraryRepository>(services) is SqliteLibraryRepository && ReferenceEquals(Microsoft.Extensions.DependencyInjection.ServiceProviderServiceExtensions.GetRequiredService<ILibraryRepository>(services), Microsoft.Extensions.DependencyInjection.ServiceProviderServiceExtensions.GetRequiredService<ILibraryRepository>(services))   // one shared repository
assert Microsoft.Extensions.DependencyInjection.ServiceProviderServiceExtensions.GetRequiredService<IClock>(services) is SystemClock && ReferenceEquals(Microsoft.Extensions.DependencyInjection.ServiceProviderServiceExtensions.GetRequiredService<Microsoft.Data.Sqlite.SqliteConnection>(services), Microsoft.Extensions.DependencyInjection.ServiceProviderServiceExtensions.GetRequiredService<Microsoft.Data.Sqlite.SqliteConnection>(services))
assert !ReferenceEquals(Microsoft.Extensions.DependencyInjection.ServiceProviderServiceExtensions.GetRequiredService<LibraryViewModel>(services), Microsoft.Extensions.DependencyInjection.ServiceProviderServiceExtensions.GetRequiredService<LibraryViewModel>(services)) && !ReferenceEquals(Microsoft.Extensions.DependencyInjection.ServiceProviderServiceExtensions.GetRequiredService<LendingService>(services), Microsoft.Extensions.DependencyInjection.ServiceProviderServiceExtensions.GetRequiredService<LendingService>(services))   // new view models and services each time
var repository = Microsoft.Extensions.DependencyInjection.ServiceProviderServiceExtensions.GetRequiredService<ILibraryRepository>(services);
repository.CreateSchemaAsync().GetAwaiter().GetResult(); repository.AddToolAsync("Drill", "Power tools").GetAwaiter().GetResult();
assert File.Exists(path) && repository.SearchAsync("").GetAwaiter().GetResult().Count == 1   // the database file at the given path
var screen = Microsoft.Extensions.DependencyInjection.ServiceProviderServiceExtensions.GetRequiredService<LibraryViewModel>(services); screen.LoadCommand.ExecuteAsync(null).GetAwaiter().GetResult();
assert screen.Tools.Single().Name == "Drill"   // a view model straight from the container works end to end
```

## The Finished App

What's left is the window, and by now it's only bindings (Capstone 1's last challenge): a search box and a list bound to `Tools` and `SelectedTool`, a borrower box, the two command buttons, and the status line. The real `Main` starts the host and shows it:

```dotnet
using System.IO;
using System.Windows;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

static class Program
{
    [STAThread]
    static void Main()
    {
        string database = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ToolLibrary", "tools.db");
        Directory.CreateDirectory(Path.GetDirectoryName(database)!);
        using IHost host = AppHost.Build(database);
        host.Services.GetRequiredService<ILibraryRepository>().CreateSchemaAsync().GetAwaiter().GetResult();

        var screen = host.Services.GetRequiredService<LibraryViewModel>();
        var window = new MainWindow { DataContext = screen };
        window.Loaded += async (_, _) => await screen.LoadCommand.ExecuteAsync(null);
        new Application().Run(window);
    }
}
```

`GetAwaiter().GetResult()` waits for a task without `await`, acceptable here only because nothing is running yet and SQLite's methods complete synchronously anyway (level 34).

The whole series in one app: a record type and `DateOnly` (level 2), interfaces (4), a WPF window of bindings (6–25), MVVM with the toolkit and async commands (14, 26, 27), dependency injection (28), tests and mutants (31), SQLite and a `JOIN` (34). Every class has one job and can be tested on its own, and the only place that knows how they fit together is `AppHost`.

**SE lens:** Where would the next feature go? "Members can reserve a tool that's out": a `Reservations` table and repository methods (storage), a rule in `LendingService` that a reserved tool goes to the reserver first (rules, with tests), a command on the screen (view model), and a button (view). Each layer changes for its own reason, which is what keeps an application like this maintainable as it grows: the question "where does this code go?" always has one answer.
