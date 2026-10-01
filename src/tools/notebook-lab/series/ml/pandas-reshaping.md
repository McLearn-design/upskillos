# pandas: reshaping and joining

The last lesson asked questions about one set of rows at a time: the houses in the North, the houses with a garden. Most interesting questions compare **every** group at once. What is the average price in each neighbourhood? Which month had the most sales? How does each shop's revenue compare with last year's? And real data rarely arrives in one tidy table: customers are in one file, orders in another, products in a third, and they have to be combined before you can ask anything.

This lesson covers the pandas tools for these jobs: `groupby` to summarise groups, `merge` to join tables, `pivot_table` to reshape a long list into a grid, and the everyday cleaning of messy text, dates and duplicates. Together with the last lesson, they are most of what data preparation involves day to day.

## The data for this lesson

Two small tables from an online shop: `orders`, one row per order, and `customers`, one row per customer. Both are written as CSV text in the cell, as in the last lesson.

```python
import io
import pandas as pd

orders = pd.read_csv(io.StringIO("""order_id,customer_id,date,product,category,quantity,unit_price
1001,C1,2024-01-05,Kettle,Kitchen,1,29.99
1002,C2,2024-01-07,Mug,Kitchen,4,6.50
1003,C1,2024-01-19,Lamp,Home,2,24.00
1004,C3,2024-02-02,Towel,Bath,3,12.00
1005,C4,2024-02-11,Kettle,Kitchen,1,29.99
1006,C2,2024-02-14,Candle,Home,6,4.75
1007,C5,2024-02-20,Mug,Kitchen,2,6.50
1008,C3,2024-03-03,Lamp,Home,1,24.00
1009,C1,2024-03-09,Towel,Bath,2,12.00
1010,C6,2024-03-15,Candle,Home,10,4.75
1011,C4,2024-03-22,Mug,Kitchen,6,6.50
1012,C2,2024-03-30,Kettle,Kitchen,1,29.99
"""))
customers = pd.read_csv(io.StringIO("""customer_id,name,city,joined
C1,Ada,London,2022-06-01
C2,Grace,Leeds,2023-01-15
C3,Alan,London,2021-11-30
C4,Linus,Bristol,2023-09-09
C5,Margaret,Leeds,2024-02-01
C7,Tim,York,2024-03-01
"""))
orders = orders.assign(revenue=orders["quantity"] * orders["unit_price"])
print(orders.shape, customers.shape)
orders.head()
```

Each order gets a `revenue` column, quantity times price. `assign` is another way to add a column: instead of changing the DataFrame in place, it returns a **new** DataFrame with the extra column, leaving the original untouched, which is what you want inside a function that must not change its input. Here the result is stored back in `orders`. Notice two deliberate mismatches: order 1010 is from customer `C6`, who is not in the customer table, and customer `C7` (Tim) has placed no orders. Real tables rarely match up perfectly, and you will see below how joins handle it.

## groupby: split, apply, combine

"Total revenue per category" needs three steps: **split** the rows into groups by category, **apply** a calculation (the sum) to each group, and **combine** the results into one table. `groupby` does all three:

```python
print(orders.groupby("category")["revenue"].sum())
```

Read it as: group the orders by category, take the revenue column, and sum it within each group. The result is a Series indexed by category. Predict which category makes the most revenue before running the next cell, which asks several questions at once:

```python
summary = orders.groupby("category").agg(
    orders=("order_id", "count"),
    units=("quantity", "sum"),
    revenue=("revenue", "sum"),
    average_order=("revenue", "mean"),
)
summary.sort_values("revenue", ascending=False).round(2)
```

`agg` computes several summaries at once. Each argument names an output column and says which input column to use and how to summarise it: `"count"`, `"sum"`, `"mean"`, `"min"`, `"max"`, `"median"`, `"nunique"` (number of distinct values) and more. This one line replaces a loop with a dictionary of running totals, the grouping pattern from Python lesson 10.

You can group by several columns at once; each combination becomes a group:

```python
orders.groupby(["category", "product"])["quantity"].sum()
```

The result has a **two-level index**, category then product. `reset_index()` turns the index levels back into ordinary columns, which is usually easier to work with:

```python
orders.groupby(["category", "product"])["quantity"].sum().reset_index()
```

## Dates

The `date` column was read as text. Converting it to real dates lets pandas understand months, weekdays and time differences:

```python
orders["date"] = pd.to_datetime(orders["date"])
orders["month"] = orders["date"].dt.month
orders["weekday"] = orders["date"].dt.day_name()
print(orders[["date", "month", "weekday"]].head(3))
print(orders.groupby("month")["revenue"].sum())
```

`pd.to_datetime` parses the text. The `.dt` accessor then gives parts of each date: `.dt.month`, `.dt.year`, `.dt.day_name()` and many others. Grouping by month gives monthly revenue, the most common question asked of any sales data.

Subtracting two dates gives a time difference, and `.dt.days` turns it into a number of days. How long after joining did each customer place their first order?

```python
customers["joined"] = pd.to_datetime(customers["joined"])
first_order = orders.groupby("customer_id")["date"].min()
wait = first_order - customers.set_index("customer_id")["joined"]
print(wait.dt.days)
```

`set_index("customer_id")` makes the customer id the row labels, so the subtraction lines each customer's first order up with their own join date. Customers missing from either side (C6 has no join date, C7 no orders) get NaN.

## Joining tables with merge

To report revenue per **city**, you need information from both tables: the revenue is in `orders`, the city is in `customers`. The column they share, `customer_id`, is the **key** that links them. `pd.merge` combines them, matching rows with the same key:

```python
joined = pd.merge(orders, customers, on="customer_id", how="left")
joined[["order_id", "customer_id", "name", "city", "revenue"]]
```

Each order row now carries its customer's name and city. The `how` argument decides what happens to rows without a match:

- `how="left"` keeps every row of the **left** table (orders), filling in NaN where there is no matching customer. Order 1010, from the unknown `C6`, is kept, with a missing name and city.
- `how="inner"` keeps only rows with a match in **both** tables, so order 1010 disappears.
- `how="right"` keeps every row of the right table; `how="outer"` keeps everything from both.

Predict how many rows each kind of join produces, then check:

```python
for how in ["inner", "left", "right", "outer"]:
    print(how, len(pd.merge(orders, customers, on="customer_id", how=how)))
```

Inner loses the order from `C6`, leaving 11. Left keeps it: 12. Right drops the order from `C6` but adds a row for Tim (`C7`), who has no orders, so it also has 12, for a different reason. Outer keeps both: 13. Choosing the wrong join is one of the most common data mistakes, because nothing fails: rows simply vanish, or appear with gaps. After any merge, check the number of rows against what you expected.

Now revenue per city is a groupby on the joined table:

```python
joined.groupby("city", dropna=False)["revenue"].sum().sort_values(ascending=False)
```

`dropna=False` keeps a group for the missing city, so the revenue from the unknown customer is not silently dropped from the totals.

## Pivot tables: a long list into a grid

`groupby` with two columns gives a long list. Often a **grid** is easier to read, with one variable down the side and another across the top. `pivot_table` builds one, exactly like a spreadsheet's pivot table:

```python
grid = orders.pivot_table(index="category", columns="month", values="revenue", aggfunc="sum", fill_value=0)
grid
```

Rows are categories, columns are months, and each cell is the total revenue for that combination. `fill_value=0` puts 0 where a category had no sales that month, instead of NaN. Going the other way, from a wide grid back to a long list, is called **melting**:

```python
grid.reset_index().melt(id_vars="category", value_name="revenue")
```

Each row is now one category and month again. Many plotting and modelling tools want the long form, so you will switch between the two.

## Cleaning messy columns

Real data is messier than these tables. Here is a column of city names as they might be typed by customers:

```python
import pandas as pd

raw = pd.Series(["London", " london", "LONDON ", "Leeds", "leeds.", "Bristol", None])
clean = raw.str.strip().str.lower().str.replace(".", "", regex=False).str.title()
print(clean.value_counts(dropna=False))
```

The `.str` accessor applies string methods, the ones from Python lesson 3, to every value in a column. Here: `strip` removes stray spaces, `lower` makes the case consistent, `replace` removes the full stop, and `title` capitalises each word for display. Seven messy values become three clean cities, plus a missing one. Without this, a `groupby` would treat "London", " london" and "LONDON " as three different cities.

Two more checks belong in every cleaning session:

```python
import pandas as pd

sales = pd.DataFrame({"order": [1, 2, 2, 3], "amount": ["10.50", "7", "7", "n/a"]})
print(sales.duplicated().sum(), "duplicate row(s)")
sales = sales.drop_duplicates()
sales["amount"] = pd.to_numeric(sales["amount"], errors="coerce")
print(sales)
print(sales.dtypes)
```

`duplicated()` marks rows that repeat an earlier row exactly, and `drop_duplicates()` removes them: a row entered twice would otherwise be counted twice. Given a column name, `drop_duplicates("col")` instead keeps only the **first** row for each value of that column, which is handy after sorting: sort by revenue from highest to lowest, then `drop_duplicates("city")` keeps the top row for each city. `pd.to_numeric` converts text to numbers, and `errors="coerce"` turns anything that cannot be converted, like `"n/a"`, into NaN instead of raising an error. Numbers stored as text are extremely common in real files, and they make sums and means fail or, worse, behave strangely.

Missing values themselves can be filled with `fillna`, for example with a column's median, or dropped with `dropna`. Which is right depends on why the values are missing, and a later lesson on feature engineering treats this properly.

::: challenge Revenue by category [easy]
Write a function `category_report(orders)` that takes an orders DataFrame like the lesson's (with `category`, `quantity` and `unit_price` columns, but **no** `revenue` column yet) and returns a DataFrame indexed by category with two columns:

- `revenue`: the total of quantity × unit price,
- `orders`: the number of orders,

sorted by revenue from highest to lowest. Do not change the DataFrame passed in.

```python starter
import pandas as pd

def category_report(orders):
    return orders
```

```python solution
import pandas as pd

def category_report(orders):
    data = orders.assign(revenue=orders["quantity"] * orders["unit_price"])
    report = data.groupby("category").agg(revenue=("revenue", "sum"), orders=("revenue", "count"))
    return report.sort_values("revenue", ascending=False)
```

```python test
import io as _io
import pandas as _pd
assert "category_report" in dir(), "Keep the function's name as category_report."
_o = _pd.read_csv(_io.StringIO("""order_id,category,quantity,unit_price
1,Kitchen,1,30.0
2,Home,4,5.0
3,Kitchen,2,10.0
4,Bath,3,12.0
5,Home,1,2.0
"""))
_before = _o.copy()
_r = category_report(_o)
assert isinstance(_r, _pd.DataFrame), "Return a DataFrame."
assert list(_r.index) == ["Kitchen", "Bath", "Home"], f"The categories sorted by revenue should be ['Kitchen', 'Bath', 'Home'], but got {list(_r.index)}."
assert _r.loc["Kitchen", "revenue"] == 50 and _r.loc["Home", "revenue"] == 22 and _r.loc["Bath", "revenue"] == 36, f"Revenues should be Kitchen 50, Bath 36, Home 22, but got {_r['revenue'].to_dict()}."
assert _r["orders"].to_dict() == {"Kitchen": 2, "Bath": 1, "Home": 2}, f"Order counts should be Kitchen 2, Bath 1, Home 2, but got {_r['orders'].to_dict()}."
assert _o.equals(_before), "category_report changed the DataFrame it was given. `assign` returns a new DataFrame; use it or work on a copy."
"SUCCESS: Split, apply, combine, in two lines."
```

Hint: `orders.assign(revenue=...)` returns a new DataFrame with an extra column, leaving the original alone. Then `groupby("category").agg(...)` with named outputs, and `sort_values`.
:::

::: challenge Best customer per city [medium]
Write a function `top_customer_by_city(orders, customers)` that returns a dictionary mapping each **city** to the **name** of the customer in that city with the highest total revenue. Revenue is quantity × unit price. Only count orders whose customer appears in the customer table.

```python starter
import pandas as pd

def top_customer_by_city(orders, customers):
    return {}
```

```python solution
import pandas as pd

def top_customer_by_city(orders, customers):
    data = orders.assign(revenue=orders["quantity"] * orders["unit_price"])
    joined = pd.merge(data, customers, on="customer_id", how="inner")
    totals = joined.groupby(["city", "name"])["revenue"].sum().reset_index()
    best = totals.sort_values("revenue", ascending=False).drop_duplicates("city")
    return dict(zip(best["city"], best["name"]))
```

```python test
import io as _io
import pandas as _pd
assert "top_customer_by_city" in dir(), "Keep the function's name as top_customer_by_city."
_o = _pd.read_csv(_io.StringIO("""order_id,customer_id,quantity,unit_price
1,C1,1,45.0
2,C2,4,5.0
3,C3,2,40.0
4,C1,1,40.0
5,C4,10,10.0
6,C9,100,100.0
7,C2,1,20.0
"""))
_c = _pd.read_csv(_io.StringIO("""customer_id,name,city
C1,Ada,London
C2,Grace,Leeds
C3,Alan,London
C4,Linus,Leeds
"""))
_got = top_customer_by_city(_o, _c)
assert isinstance(_got, dict), "Return a dictionary."
assert _got == {"London": "Ada", "Leeds": "Linus"}, f"The best customers are Ada (London: 45 + 40 = 85, more than Alan's single order of 80) and Linus (Leeds, 100), but got {_got}. Add up each customer's orders before comparing."
"SUCCESS: A merge, a groupby, and a sort: a real reporting question answered."
```

Hint: Merge with `how="inner"` so orders from unknown customers drop out. Group by city and name and sum the revenue. Then sort by revenue from highest to lowest, and keep the first row for each city: `drop_duplicates("city")` keeps the first occurrence.
:::

::: challenge Clean the survey [medium]
A survey export has messy columns. Write a function `clean_survey(df)` that returns a **new** cleaned DataFrame:

1. remove exact duplicate rows;
2. in `city`, strip spaces and make each value title case (`"  new york"` becomes `"New York"`);
3. convert `age` to numbers, turning anything that is not a number into NaN;
4. drop rows where `age` is missing.

Then return the result with a fresh index from 0, using `reset_index(drop=True)`.

```python starter
import pandas as pd

def clean_survey(df):
    return df
```

```python solution
import pandas as pd

def clean_survey(df):
    clean = df.drop_duplicates().copy()
    clean["city"] = clean["city"].str.strip().str.title()
    clean["age"] = pd.to_numeric(clean["age"], errors="coerce")
    clean = clean.dropna(subset=["age"])
    return clean.reset_index(drop=True)
```

```python test
import pandas as _pd
assert "clean_survey" in dir(), "Keep the function's name as clean_survey."
_raw = _pd.DataFrame({
    "respondent": [1, 2, 2, 3, 4, 5],
    "city": ["  new york", "LEEDS ", "LEEDS ", "leeds", "Paris", " london"],
    "age": ["34", "29", "29", "unknown", "41", "  "],
})
_before = _raw.copy()
_got = clean_survey(_raw)
assert list(_got["respondent"]) == [1, 2, 4], f"After removing the duplicate and the rows with no usable age, respondents [1, 2, 4] should remain, but got {list(_got['respondent'])}."
assert list(_got["city"]) == ["New York", "Leeds", "Paris"], f"Cities should be cleaned to ['New York', 'Leeds', 'Paris'], but got {list(_got['city'])}."
assert list(_got["age"]) == [34, 29, 41], f"Ages should be the numbers [34, 29, 41], but got {list(_got['age'])}."
assert list(_got.index) == [0, 1, 2], "Give the result a fresh index with reset_index(drop=True)."
assert _raw.equals(_before), "clean_survey changed the DataFrame it was given. Work on a copy."
"SUCCESS: Duplicates gone, text tidied, numbers made numeric."
```

Hint: Start with `df.drop_duplicates().copy()`. Chain `.str.strip().str.title()` on the city column, use `pd.to_numeric(..., errors="coerce")` on age, then `dropna(subset=["age"])`. An age of only spaces also becomes NaN when coerced.
:::

## What you learned

- `df.groupby("col")["x"].sum()` splits rows into groups, applies a summary to each, and combines the results. `agg` computes several named summaries at once; grouping by several columns gives a multi-level index, and `reset_index()` turns it back into columns.
- `pd.to_datetime` turns text into dates; the `.dt` accessor gives months, weekdays and more.
- `pd.merge(left, right, on="key", how=...)` joins tables on a shared key. `inner` keeps only matches, `left` keeps every left row, `right` every right row, `outer` everything. Always check the row count after a merge.
- `pivot_table` turns a long list into a grid of summaries; `melt` goes back.
- The `.str` accessor applies string methods to a whole column. `duplicated`/`drop_duplicates` find and remove repeated rows. `pd.to_numeric(..., errors="coerce")` turns text into numbers, with NaN for anything unconvertible.

Next you will put all of this together on a complete dataset: an exploratory analysis that asks questions, answers them with tables and plots, and writes down what it finds.
