---
series: wpf-mastery
level: 34
title: SQLite and the Repository Pattern
lang: csharp
---

# SQLite and the Repository Pattern

A settings file (level 33) holds one small object. An app with customers, orders and thousands of records needs a **database**: data you can query ("orders over £100 from last month"), update one row at a time, and keep consistent when two things change together. **SQLite** is a complete SQL database in a single file, with no server to install, which makes it the standard choice for desktop apps. This lesson uses it through `Microsoft.Data.Sqlite`: connections, commands and readers; why every value must go in as a **parameter** (measured with an apostrophe and with an attack); transactions, which turned a 9-second import into 15 ms; and the **repository pattern**, which keeps SQL out of view models so they stay testable (level 31). You'll write a repository and an all-or-nothing import.

## Connections, Commands and Readers

Three objects do all the work:

- a **`SqliteConnection`**, opened on a connection string such as `Data Source=shop.db` (a file, created if it doesn't exist) or `Data Source=:memory:` (a database that exists only while this connection is open: ideal for examples and tests);
- a **`SqliteCommand`**, created with `connection.CreateCommand()`, holding SQL in `CommandText`;
- and one of three ways to run it: **`ExecuteNonQuery()`** for statements that change data (returns the number of rows affected), **`ExecuteScalar()`** for a single value, and **`ExecuteReader()`** for rows, read one at a time with `reader.Read()` and `reader.GetString(column)`.

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
    <PackageReference Include="Microsoft.Data.Sqlite" Version="9.0.20" />
  </ItemGroup>

</Project>
```

```project console file=Program.cs
using Microsoft.Data.Sqlite;

using var connection = new SqliteConnection("Data Source=:memory:");
connection.Open();

var create = connection.CreateCommand();
create.CommandText = "CREATE TABLE Customers (Id INTEGER PRIMARY KEY, Name TEXT NOT NULL UNIQUE, City TEXT)";
create.ExecuteNonQuery();

var insert = connection.CreateCommand();
insert.CommandText = "INSERT INTO Customers (Name, City) VALUES ('Ada', 'London'), ('Grace', 'New York'), ('Linus', NULL)";
Console.WriteLine($"rows inserted: {insert.ExecuteNonQuery()}");

var count = connection.CreateCommand();
count.CommandText = "SELECT COUNT(*) FROM Customers";
Console.WriteLine($"COUNT(*) = {count.ExecuteScalar()} (a {count.ExecuteScalar()!.GetType().Name})");

var select = connection.CreateCommand();
select.CommandText = "SELECT Id, Name, City FROM Customers ORDER BY Name";
using var reader = select.ExecuteReader();
while (reader.Read())
{
    long id = reader.GetInt64(0);
    string name = reader.GetString(1);
    string city = reader.IsDBNull(2) ? "(unknown)" : reader.GetString(2);
    Console.WriteLine($"{id}: {name}, {city}");
}
```

`INTEGER PRIMARY KEY` makes `Id` a number SQLite assigns itself, 1, 2, 3...; `NOT NULL` and `UNIQUE` are **constraints** the database enforces. `using var` (level 4) disposes the connection and the reader at the end of the program. The output:

```text
rows inserted: 3
COUNT(*) = 3 (a Int64)
1: Ada, London
2: Grace, New York
3: Linus, (unknown)
```

Two type details catch everyone. SQLite's integers come back as **`long`** (`Int64`), so `(int)command.ExecuteScalar()` throws an `InvalidCastException`: convert with `Convert.ToInt32(...)` or read a `long`. And a SQL **`NULL`** is not C#'s `null`. A reader reports it through `IsDBNull(column)`, and `ExecuteScalar` returns the special object **`DBNull.Value`** for a `NULL` column, but plain `null` when there was **no row at all** (both measured). Check for the one you mean.

## Parameters, Always

The obvious way to search for a name typed by the user is to build the SQL with it: `"... WHERE Name = '" + typed + "'"`. Measured against the table above, with three things a user might type:

```text
concatenated [Ada]:           1 rows
concatenated [O'Brien]:       SqliteException: SQLite Error 1: 'near "Brien": syntax error'.
concatenated [x' OR '1'='1]:  3 rows   SQL: SELECT COUNT(*) FROM Customers WHERE Name = 'x' OR '1'='1'
parameter    [Ada]:           1 rows
parameter    [O'Brien]:       0 rows
parameter    [x' OR '1'='1]:  0 rows
```

An apostrophe in a real surname **crashed** the query, and the third input changed what the query *means*: it matched every row, because the typed text became SQL. That's **SQL injection**, and with an `UPDATE` or `DELETE` instead of a `SELECT` it destroys data. The fix is a **parameter**: a placeholder in the SQL (`$name`), with the value sent separately, so it can never be read as SQL:

```dotnet
var command = connection.CreateCommand();
command.CommandText = "SELECT COUNT(*) FROM Customers WHERE Name = $name";
command.Parameters.AddWithValue("$name", typed);
```

The rule has no exceptions: **every value that comes from outside the code goes in as a parameter**, whether it's from a user, a file or another system. Parameters also handle types: a `DateTime` or `decimal` goes in correctly without you formatting it as text.

**SE lens:** "But this value can't contain an apostrophe" is how injection bugs ship. Code changes, data arrives from new places, and the one query built by concatenation becomes the hole. Reviewers treat string-built SQL as a defect on sight, so don't write it even when you're sure.

## Transactions: All or Nothing, and Fast

A **transaction** groups statements so that either all of them take effect or none do. `connection.BeginTransaction()` starts one; each command joins it by setting `command.Transaction`; **`Commit()`** makes the changes permanent, and **`Rollback()`** (or disposing the transaction without committing) undoes them. Two measurements on a file database show why transactions matter:

```text
1000 inserts, no transaction:   9307 ms
1000 inserts, one transaction:  15 ms

a batch of 3 inserts whose third breaks a UNIQUE constraint:
   inside a transaction, rolled back:  0 rows left from the batch
   without a transaction:              2 rows left from the batch
```

**Speed:** without a transaction, SQLite treats every statement as its own transaction and makes sure it's safely on disk before returning, 1,000 times. Inside one transaction it does that once. That's 600 times faster here, and the reason any bulk import must use a transaction.

**Correctness:** the batch failed on its third row (SQLite error 19, `UNIQUE constraint failed`). Without a transaction, the first two rows stayed: half an import, which is usually worse than none. With one, the rollback removed them, and the data was exactly as before.

```dotnet
using var transaction = connection.BeginTransaction();
try
{
    foreach (var product in products)
    {
        var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "INSERT INTO Products (Name, Price) VALUES ($name, $price)";
        command.Parameters.AddWithValue("$name", product.Name);
        command.Parameters.AddWithValue("$price", product.Price);
        command.ExecuteNonQuery();
    }
    transaction.Commit();
}
catch (SqliteException)
{
    transaction.Rollback();
    throw;
}
```

`throw;` on its own re-throws the exception that was caught, after the rollback, so the caller still learns the import failed.

## The Repository Pattern

A view model that contains SQL has three problems: it can't be tested without a database, the SQL is scattered across view models, and changing the database means changing the UI code. A **repository** is a class that hides the data storage behind an interface describing what the app needs, in its own terms:

```dotnet
public interface IProductRepository
{
    Task CreateSchemaAsync();
    Task<long> AddAsync(Product product);
    Task<IReadOnlyList<Product>> GetAllAsync();
    Task<Product?> FindByNameAsync(string name);
}
```

The view model depends on `IProductRepository` (level 28's injection); the app registers `SqliteProductRepository`; tests (level 31) pass an in-memory fake, or a real repository on a `:memory:` database. All the SQL lives in one class.

The methods are `async` because database access is I/O (level 13). One measured surprise: **Microsoft.Data.Sqlite's async methods actually run synchronously.** `ExecuteReaderAsync` returned an already-completed task, on the same thread. SQLite is an in-process library, not a network server, so there's nothing to wait for asynchronously. The `async` interface still earns its place: the same repository interface can later be implemented over a network database, where it is truly asynchronous. And for long SQLite queries in a WPF app, run the work with `Task.Run` (level 13) to keep the window responsive.

Getting the new row's id: SQLite's **`RETURNING`** clause makes an `INSERT` return values from the inserted row, read with `ExecuteScalar`: `INSERT INTO Products (Name, Price) VALUES ($name, $price) RETURNING Id` returns the new `Id` (measured: as an `Int64`).

## Challenge: product_repository

Write **`SqliteProductRepository`** in `SqliteProductRepository.cs`, implementing `IProductRepository` (read-only) over the `SqliteConnection` its constructor receives (already open):

- **`CreateSchemaAsync()`** creates a table `Products` with `Id INTEGER PRIMARY KEY`, `Name TEXT NOT NULL UNIQUE` and `Price REAL NOT NULL`;
- **`AddAsync(product)`** inserts the product and returns its new `Id`;
- **`GetAllAsync()`** returns every product, **ordered by name**;
- **`FindByNameAsync(name)`** returns the product with exactly that name, or `null`.

Use parameters for every value. `reader.GetDouble(column)` reads a `REAL`; `Convert.ToInt64(value)` turns an `ExecuteScalar` result into a `long`.

```challenge console file=SqliteProductRepository.cs
using Microsoft.Data.Sqlite;

namespace LessonApp;

public class SqliteProductRepository : IProductRepository
{
    public SqliteProductRepository(SqliteConnection connection) { }

    public Task CreateSchemaAsync() => Task.CompletedTask;

    public Task<long> AddAsync(Product product) => Task.FromResult(0L);

    public Task<IReadOnlyList<Product>> GetAllAsync() => Task.FromResult<IReadOnlyList<Product>>(new List<Product>());

    public Task<Product?> FindByNameAsync(string name) => Task.FromResult<Product?>(null);
}
```

```challenge console file=IProductRepository.cs readonly
namespace LessonApp;

public record Product(long Id, string Name, double Price);

public interface IProductRepository
{
    Task CreateSchemaAsync();
    Task<long> AddAsync(Product product);
    Task<IReadOnlyList<Product>> GetAllAsync();
    Task<Product?> FindByNameAsync(string name);
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
    <PackageReference Include="Microsoft.Data.Sqlite" Version="9.0.20" />
  </ItemGroup>

</Project>
```

```test
var connection = new Microsoft.Data.Sqlite.SqliteConnection("Data Source=:memory:"); connection.Open();
var repository = new SqliteProductRepository(connection);
repository.CreateSchemaAsync().GetAwaiter().GetResult();
assert repository.GetAllAsync().GetAwaiter().GetResult().Count == 0   // an empty table
var teaId = repository.AddAsync(new Product(0, "Tea", 3.5)).GetAwaiter().GetResult();
var coffeeId = repository.AddAsync(new Product(0, "Coffee", 4.25)).GetAwaiter().GetResult();
assert teaId > 0 && coffeeId > teaId   // AddAsync returns the new ids
assert string.Join(",", repository.GetAllAsync().GetAwaiter().GetResult().Select(p => p.Name)) == "Coffee,Tea"   // ordered by name
repository.AddAsync(new Product(0, "O'Brien's Blend", 7)).GetAwaiter().GetResult();
assert repository.FindByNameAsync("O'Brien's Blend").GetAwaiter().GetResult()?.Price == 7   // an apostrophe is just a character: parameters
assert repository.FindByNameAsync("x' OR '1'='1").GetAwaiter().GetResult() == null && repository.FindByNameAsync("Cof").GetAwaiter().GetResult() == null   // no injection, and only an exact name matches
assert repository.FindByNameAsync("Coffee").GetAwaiter().GetResult() == new Product(coffeeId, "Coffee", 4.25)
```

## Challenge: atomic_import

Write **`ProductImporter.ImportAsync(IEnumerable<Product> products)`** in `ProductImporter.cs`. It inserts every product into the `Products` table (created by the given repository's schema) **in one transaction**: if any insert fails (for example a duplicate name), **none** of the batch's products remain and the exception reaches the caller; if all succeed, all remain. It returns the number of products imported.

```challenge console file=ProductImporter.cs
using Microsoft.Data.Sqlite;

namespace LessonApp;

public class ProductImporter
{
    private readonly SqliteConnection connection;

    public ProductImporter(SqliteConnection connection) => this.connection = connection;

    public Task<int> ImportAsync(IEnumerable<Product> products)
    {
        // TODO
        return Task.FromResult(0);
    }
}
```

```challenge console file=Schema.cs readonly
using Microsoft.Data.Sqlite;

namespace LessonApp;

public record Product(long Id, string Name, double Price);

public static class Schema
{
    public static void Create(SqliteConnection connection)
    {
        var command = connection.CreateCommand();
        command.CommandText = "CREATE TABLE Products (Id INTEGER PRIMARY KEY, Name TEXT NOT NULL UNIQUE, Price REAL NOT NULL)";
        command.ExecuteNonQuery();
    }

    public static long Count(SqliteConnection connection)
    {
        var command = connection.CreateCommand();
        command.CommandText = "SELECT COUNT(*) FROM Products";
        return (long)command.ExecuteScalar()!;
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
    <PackageReference Include="Microsoft.Data.Sqlite" Version="9.0.20" />
  </ItemGroup>

</Project>
```

```test
var connection = new Microsoft.Data.Sqlite.SqliteConnection("Data Source=:memory:"); connection.Open(); Schema.Create(connection);
var importer = new ProductImporter(connection);
assert importer.ImportAsync(new[] { new Product(0, "Tea", 3.5), new Product(0, "Coffee", 4.25) }).GetAwaiter().GetResult() == 2 && Schema.Count(connection) == 2
var failed = false; try { importer.ImportAsync(new[] { new Product(0, "Cocoa", 5), new Product(0, "Milk", 1), new Product(0, "Tea", 9) }).GetAwaiter().GetResult(); } catch (Microsoft.Data.Sqlite.SqliteException) { failed = true; }
assert failed   // the duplicate Tea is reported to the caller
assert Schema.Count(connection) == 2   // and Cocoa and Milk were rolled back: all or nothing
assert importer.ImportAsync(Array.Empty<Product>()).GetAwaiter().GetResult() == 0 && Schema.Count(connection) == 2   // an empty batch changes nothing
var many = Enumerable.Range(1, 2000).Select(i => new Product(0, "Item " + i, i)).ToList();
assert importer.ImportAsync(many).GetAwaiter().GetResult() == 2000 && Schema.Count(connection) == 2002
```
