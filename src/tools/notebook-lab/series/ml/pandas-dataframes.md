# pandas: DataFrames

NumPy arrays are ideal for numbers, but real datasets are messier. A table of house sales has a price (a number), a neighbourhood (text), a date, a yes-or-no for whether there is a garden, and some cells simply missing. Each column has a name that matters, and you want to ask questions like "what is the average price of houses with a garden in the north?" without keeping track of column numbers yourself.

**pandas** is the library for exactly this. Its central object, the **DataFrame**, is a table with named columns, where each column can hold a different type of data. Nearly every data science project starts by loading data into a DataFrame, exploring it, cleaning it, and finally turning it into NumPy arrays for a model. This lesson covers loading, inspecting, selecting and adding to DataFrames; the next covers grouping, joining and cleaning.

## Loading a dataset

Data usually arrives as a CSV file. `pd.read_csv` reads one into a DataFrame. Here the CSV text is written directly into the cell, so the lesson works without any files; `io.StringIO` makes a string behave like an open file. With a real file, you would pass its path instead, such as `pd.read_csv("uploads/houses.csv")` after uploading it with **Upload data**.

```python
import io
import pandas as pd

csv_text = """id,neighbourhood,bedrooms,area_m2,year_built,price,garden
1,North,3,95,1998,285000,yes
2,South,2,68,1975,190000,no
3,North,4,140,2012,455000,yes
4,East,3,102,1988,260000,yes
5,South,1,45,1965,138000,no
6,West,5,180,2019,610000,yes
7,East,2,72,,205000,no
8,North,3,110,2005,340000,yes
9,West,4,150,2015,520000,yes
10,South,3,88,1982,215000,no
11,East,4,125,1999,315000,yes
12,West,2,70,2008,265000,no
13,North,2,65,1992,210000,no
14,South,4,130,2001,298000,yes
15,East,3,,1995,248000,no
16,West,3,105,2011,395000,yes
17,North,5,190,2020,690000,yes
18,North,2,60,1970,165000,no
19,East,1,40,1985,120000,no
20,West,3,98,2003,355000,yes
"""
houses = pd.read_csv(io.StringIO(csv_text))
houses.head()
```

`import pandas as pd` is the standard import. The triple-quoted string holds the CSV, with a header row naming the columns. `houses.head()` shows the first five rows. (As the last line of the cell, its value is shown without `print`; on a normal Jupyter setup a DataFrame displays as a formatted table.)

Notice the two empty cells in the raw text: house 7 has no `year_built` and house 15 no `area_m2`. pandas reads them as **NaN**, the "not a number" marker for missing values you met in the indexing lesson. Real data almost always has gaps like these.

## A first look

The first thing to do with any new dataset is look at its shape and contents. These cells assume the previous one has run, since all cells share one namespace.

```python
print(houses.shape)
print(houses.columns.tolist())
print(houses.dtypes)
```

`shape` is `(rows, columns)`: 20 houses, 7 columns. `dtypes` gives each column's type. `int64` columns hold whole numbers and `float64` columns decimals; `object` is pandas' general type, used here for text. Notice that `area_m2` and `year_built` are `float64` even though they hold whole numbers: NaN is a float, so a column with any missing values becomes a float column.

`info()` summarises everything at once, including how many values in each column are **not** missing:

```python
houses.info()
```

`describe()` gives summary statistics for every numeric column:

```python
houses.describe().round(1)
```

The count, mean, standard deviation (with `n − 1`, as statistics tools do), minimum, quartiles (the 25th, 50th and 75th percentiles; the 50th is the median) and maximum. Read `describe()` for anything surprising: an impossible minimum, a maximum far larger than the 75th percentile, or a count lower than the number of rows, which means missing values.

## Columns are Series

Selecting a column with square brackets and its name gives a **Series**: a one-dimensional column of values with an **index**, the row labels shown down the left. Most of what you know from NumPy works on it directly.

```python
prices = houses["price"]
print(type(prices))
print(prices.mean().round(0), prices.max())
print((prices / 1000).head(3))
```

A Series is essentially a NumPy array with labels attached, and `.to_numpy()` gives you the plain array. Arithmetic, comparisons and methods like `mean` and `max` all work. Summary methods like `mean` and `max` skip missing values automatically; arithmetic passes them through, so a missing value plus 1 is still missing.

For a text column, two methods are especially useful:

```python
print(houses["neighbourhood"].value_counts())
print(houses["neighbourhood"].nunique(), "different neighbourhoods")
```

`value_counts()` counts each distinct value, largest first: the counting pattern from Python lesson 10, in one call.

To select several columns, pass a **list** of names, which gives a smaller DataFrame (note the double square brackets: the outer pair selects, the inner pair makes the list):

```python
houses[["neighbourhood", "price"]].head(3)
```

## Selecting rows with conditions

Boolean masks work on DataFrames just as on arrays. A comparison on a column gives a Series of `True`/`False`, and using it inside square brackets keeps the matching rows:

```python
big = houses["area_m2"] > 120
houses[big]
```

Predict how many houses are both in the North and have a garden, before running this:

```python
north_with_garden = houses[(houses["neighbourhood"] == "North") & (houses["garden"] == "yes")]
print(len(north_with_garden))
north_with_garden[["id", "bedrooms", "price"]]
```

As with NumPy, combine conditions with `&` (and), `|` (or) and `~` (not), with parentheses around each comparison. Two helpers make common conditions shorter:

```python
print(houses[houses["neighbourhood"].isin(["East", "West"])].shape[0], "houses in East or West")
print(houses[houses["price"].between(200_000, 300_000)].shape[0], "houses priced 200k to 300k")
```

`isin` checks membership in a list, and `between` checks a range, including both ends.

## loc and iloc

For selecting rows **and** columns together, pandas has two indexers:

- `.loc[rows, columns]` selects by **label**: row index labels, column names, or boolean masks.
- `.iloc[rows, columns]` selects by **position**, like NumPy: numbers from 0.

```python
print(houses.loc[houses["bedrooms"] >= 4, ["neighbourhood", "bedrooms", "price"]])
print(houses.iloc[0:3, 0:4])
```

The first line reads "rows with at least 4 bedrooms, and these three columns". The second takes the first three rows and first four columns by position. Here the index labels happen to be 0, 1, 2, ... so the two can look alike, but after filtering or sorting the labels stay attached to their rows while positions do not, so it matters which you use. Prefer `.loc` with column names: it keeps working when columns are added or reordered.

## Adding and changing columns

Assigning to a new column name adds a column. The calculation works on whole columns at once, so there is no loop:

```python
houses["price_per_m2"] = (houses["price"] / houses["area_m2"]).round(0)
houses["age"] = 2024 - houses["year_built"]
houses["has_garden"] = houses["garden"] == "yes"
houses[["id", "price_per_m2", "age", "has_garden"]].head()
```

Missing values carry through: house 15 has no area, so its price per square metre is NaN too, and house 7 has no age. `has_garden` turns the text into `True`/`False`, which is how a yes-or-no column is usually prepared for a model.

To change values in some rows only, use `.loc` with a mask and a column name. Assigning through a filtered copy instead (`houses[mask]["col"] = ...`) changes nothing, and pandas only warns; `.loc[mask, "col"] = ...` always changes the DataFrame itself.

```python
houses.loc[houses["neighbourhood"] == "West", "neighbourhood"] = "West End"
print(houses["neighbourhood"].unique())
```

## Sorting

`sort_values` sorts the rows by one or more columns:

```python
print(houses.sort_values("price", ascending=False)[["id", "neighbourhood", "price"]].head(3))
print(houses.nsmallest(3, "price_per_m2")[["id", "price_per_m2"]])
```

`ascending=False` sorts largest first. `nlargest` and `nsmallest` are shortcuts for "the top `n` by this column". Sorting keeps each row's index label, which is one reason `.loc` and `.iloc` can differ afterwards.

## From a DataFrame to model inputs

A model needs plain numeric arrays: a 2D feature array `X` with one row per example, and a 1D target array `y`. Select the columns, and convert with `.to_numpy()`:

```python
complete = houses.dropna(subset=["area_m2", "age"])
X = complete[["bedrooms", "area_m2", "age"]].to_numpy()
y = complete["price"].to_numpy()
print(X.shape, y.shape)
print(X[:3])
```

`dropna(subset=[...])` drops the rows missing any of those columns, here houses 7 and 15. One more habit: a table made by filtering or `dropna` may share its data with the original, so if you are going to add or change columns in it, call `.copy()` first, as in `complete = houses.dropna(subset=["area_m2"]).copy()`. Otherwise pandas warns that you may be changing a copy, and the change may not behave as you expect. Dropping is the bluntest way to handle missing data, and it throws information away; the next lesson and the feature engineering lesson look at better options. From here on, everything you learned about arrays applies.

::: challenge Find the houses [easy]
Write a function `family_homes(df)` that takes a house DataFrame like the one in the lesson and returns a new DataFrame containing only the houses with **at least 3 bedrooms** and a **garden**, with just the columns `id`, `neighbourhood` and `price`, sorted by price from lowest to highest.

```python starter
import io
import pandas as pd

def family_homes(df):
    return df

csv_text = """id,neighbourhood,bedrooms,area_m2,year_built,price,garden
1,North,3,95,1998,285000,yes
2,South,2,68,1975,190000,no
3,North,4,140,2012,455000,yes
4,East,3,102,1988,260000,yes
5,South,4,130,2001,298000,no
"""
print(family_homes(pd.read_csv(io.StringIO(csv_text))))
```

```python solution
import io
import pandas as pd

def family_homes(df):
    chosen = df[(df["bedrooms"] >= 3) & (df["garden"] == "yes")]
    return chosen[["id", "neighbourhood", "price"]].sort_values("price")

csv_text = """id,neighbourhood,bedrooms,area_m2,year_built,price,garden
1,North,3,95,1998,285000,yes
2,South,2,68,1975,190000,no
3,North,4,140,2012,455000,yes
4,East,3,102,1988,260000,yes
5,South,4,130,2001,298000,no
"""
print(family_homes(pd.read_csv(io.StringIO(csv_text))))
```

```python test
import io as _io
import pandas as _pd
assert "family_homes" in dir(), "Keep the function's name as family_homes."
_df = _pd.read_csv(_io.StringIO("""id,neighbourhood,bedrooms,area_m2,year_built,price,garden
1,North,3,95,1998,285000,yes
2,South,2,68,1975,190000,no
3,North,4,140,2012,455000,yes
4,East,3,102,1988,260000,yes
5,South,4,130,2001,298000,no
6,West,5,180,2019,610000,yes
7,East,3,72,1990,205000,yes
"""))
_before = _df.copy()
_got = family_homes(_df)
assert isinstance(_got, _pd.DataFrame), "family_homes should return a DataFrame."
assert list(_got.columns) == ["id", "neighbourhood", "price"], f"Keep only the columns id, neighbourhood and price (in that order), but got {list(_got.columns)}."
assert _got["id"].tolist() == [7, 4, 1, 3, 6], f"The matching houses sorted by price are ids [7, 4, 1, 3, 6], but got {_got['id'].tolist()}."
assert _df.equals(_before), "Don't change the DataFrame you were given."
"SUCCESS: Filter, select, sort: the everyday pandas trio."
```

Hint: Build the mask with `&` and parentheses around each condition, select the three columns with a list, and finish with `.sort_values("price")`.
:::

::: challenge Summarise the market [medium]
Write a function `market_summary(df)` that returns a dictionary with:

- `"houses"`: the number of rows;
- `"median_price"`: the median price;
- `"garden_share"`: the fraction of houses with a garden (`"yes"`), rounded to 2 decimal places;
- `"busiest"`: the neighbourhood with the most houses;
- `"missing_cells"`: the total number of missing values in the whole DataFrame.

`df.isna()` gives a DataFrame of `True`/`False` marking missing cells, and `.sum()` of a boolean Series counts its `True` values.

```python starter
import pandas as pd

def market_summary(df):
    return {}
```

```python solution
import pandas as pd

def market_summary(df):
    return {
        "houses": len(df),
        "median_price": df["price"].median(),
        "garden_share": round((df["garden"] == "yes").mean(), 2),
        "busiest": df["neighbourhood"].value_counts().idxmax(),
        "missing_cells": int(df.isna().sum().sum()),
    }
```

```python test
import io as _io
import pandas as _pd
assert "market_summary" in dir(), "Keep the function's name as market_summary."
_df = _pd.read_csv(_io.StringIO("""id,neighbourhood,bedrooms,area_m2,year_built,price,garden
1,North,3,95,1998,285000,yes
2,South,2,68,,190000,no
3,North,4,140,2012,455000,yes
4,East,3,,1988,260000,yes
5,North,1,45,,138000,no
"""))
_got = market_summary(_df)
_want = {"houses": 5, "median_price": 260000, "garden_share": 0.6, "busiest": "North", "missing_cells": 3}
assert isinstance(_got, dict), "market_summary should return a dictionary."
for _k, _v in _want.items():
    assert _k in _got, f"The dictionary is missing the key {_k!r}."
    assert _got[_k] == _v, f"{_k!r} should be {_v!r}, but it is {_got[_k]!r}."
"SUCCESS: A whole dataset summarised in five numbers."
```

Hint: `value_counts()` is sorted largest first, and `.idxmax()` gives the label with the largest count. For the missing cells, `df.isna().sum()` counts per column; one more `.sum()` adds those up.
:::

::: challenge Ready for a model [medium]
Write a function `to_arrays(df)` that prepares a house DataFrame for a model, returning `(X, y)` as NumPy arrays:

1. drop the rows missing `area_m2` or `year_built`;
2. make a feature `age` as 2024 minus `year_built`, and a feature `garden_flag` that is 1 for `"yes"` and 0 for `"no"`;
3. `X` has the columns `bedrooms`, `area_m2`, `age` and `garden_flag`, in that order, as floats; `y` is the `price`.

Do not change the DataFrame passed in.

```python starter
import numpy as np
import pandas as pd

def to_arrays(df):
    return np.zeros((0, 4)), np.zeros(0)
```

```python solution
import numpy as np
import pandas as pd

def to_arrays(df):
    clean = df.dropna(subset=["area_m2", "year_built"]).copy()
    clean["age"] = 2024 - clean["year_built"]
    clean["garden_flag"] = (clean["garden"] == "yes").astype(int)
    X = clean[["bedrooms", "area_m2", "age", "garden_flag"]].to_numpy(dtype=float)
    y = clean["price"].to_numpy()
    return X, y
```

```python test
import io as _io
import numpy as _np
import pandas as _pd
assert "to_arrays" in dir(), "Keep the function's name as to_arrays."
_df = _pd.read_csv(_io.StringIO("""id,neighbourhood,bedrooms,area_m2,year_built,price,garden
1,North,3,95,1998,285000,yes
2,South,2,68,,190000,no
3,North,4,140,2014,455000,yes
4,East,3,,1988,260000,yes
5,North,1,45,1974,138000,no
"""))
_before = _df.copy()
_X, _y = to_arrays(_df)
assert isinstance(_X, _np.ndarray) and isinstance(_y, _np.ndarray), "Return NumPy arrays (use .to_numpy())."
assert _X.dtype == float, f"X should be an array of floats (use .to_numpy(dtype=float)), but its dtype is {_X.dtype}."
assert _X.shape == (3, 4) and _y.shape == (3,), f"After dropping the 2 incomplete rows there should be 3 examples: X shape (3, 4), y shape (3,), but got {_X.shape} and {_y.shape}."
assert _np.allclose(_X, [[3, 95, 26, 1], [4, 140, 10, 1], [1, 45, 50, 0]]), f"X should be [[3, 95, 26, 1], [4, 140, 10, 1], [1, 45, 50, 0]], but got {_X.tolist()}."
assert _np.array_equal(_y, [285000, 455000, 138000]), f"y should be [285000, 455000, 138000], but got {_y.tolist()}."
assert _df.equals(_before), "to_arrays changed the DataFrame it was given. Work on a copy."
"SUCCESS: From a messy table to the X and y every model expects."
```

Hint: `df.dropna(subset=[...]).copy()` gives a new DataFrame you can add columns to without touching the original. `(clean["garden"] == "yes").astype(int)` turns the yes/no into 1/0. Select the four columns in order and call `.to_numpy(dtype=float)`.
:::

## What you learned

- A DataFrame is a table with named columns of possibly different types; `pd.read_csv` loads one from a CSV file (or text via `io.StringIO`).
- `head`, `shape`, `dtypes`, `info` and `describe` give a first look. Missing values appear as NaN, and make whole-number columns become floats.
- `df["col"]` gives a Series, a labelled 1D array; `df[["a", "b"]]` gives a smaller DataFrame. `value_counts`, `unique` and `nunique` summarise text columns.
- Boolean masks select rows: combine with `&`, `|`, `~` and parentheses; `isin` and `between` help.
- `.loc[rows, cols]` selects by label (and masks); `.iloc` by position.
- New columns come from whole-column arithmetic. Change selected rows with `df.loc[mask, "col"] = value`.
- `sort_values`, `nlargest` and `nsmallest` order rows.
- Select feature columns and call `.to_numpy()` to get `X` and `y` for a model; `dropna` removes incomplete rows.

The questions so far looked at one group of rows at a time. Next you will answer questions about every group at once ("average price per neighbourhood"), combine tables, reshape them, and clean messy columns.
