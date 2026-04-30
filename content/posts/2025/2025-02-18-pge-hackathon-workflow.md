---
title: "PGE Hackathon Workflow"
date: 2025-02-18T00:00:00+00:00
hero: /posts/2025-02-18-pge-hackathon-workflow/hero_hackathon.jpg
theme: Toha
math: true
menu:
  sidebar:
    name: PGE Hackathon Workflow
    identifier: 2025-02-18-pge-hackathon-workflow
    parent: 2025-posts
    weight: -1
---

Recently, we have joined [PGE Hackathon 2025](https://www.pge.utexas.edu/pge-news/ut-pge-hosts-5th-annual-energy-ai-hackathon/) as a very *chill* team that had the sole purpose of eating as many tacos as we can! Interestingly, we put an ambitious work and got the 1st place. 

The competition was about predicting the fuel consumption of a given [hydraulic fracturing](https://en.wikipedia.org/wiki/Fracking) operation:

<div style="overflow-x: auto;">

| Well Name  | # Stages | # Clusters | Estimated Average Stage Time | Actual Average Stage Time | Frac Fleet | Fleet Type | Target Formation | Field Area  | Ambient Temperature | Grid | Diesel | CNG   | Fuel Type | Sand Provider |
|------------|----------|------------|------------------------------|---------------------------|------------|------------|------------------|-------------|---------------------|------|--------|-------|-----------|---------------|
| Cameron 1H | 68       | 480        | 85.7                         | 120.5                     | Fleet 4    | Zipper     | Pecan Tree       | West Campus | 35.9                | 0    | 0      | 22717 | Turbine   | SAND_C_X      |

</div>

Above is one example row with the provided data. Here, all the features and the `Fuel Type` are given and we are asked to predict how much `Grid`, `Diesel` or `CNG` is used for the operation.

~For full context, the reader can refer to [this page](https://github.com/PGEHackathon/data).~ Unfortunately, this page has been updated with the next year's challenge, so this is not possible anymore.

Here is a brief walkthrough of our solution.

## Workflow Steps

1. **Preprocessing**  
   Basic data checks, missing value exploration, and visualization.

2. **Feature Engineering**  
   Imputed missing values and created a new feature, “Estimated Total Time.”

3. **Feature Selection**  
   Used mutual information and redundancy reduction for robust feature sets.

4. **Model Building**  
   Trained a multi‐output random forest model for prediction.

5. **Uncertainty Quantification**  
   Fine‐tuned uncertainty modeling using UTuning and \\( p - \xi(p) \\) plots.

6. **Prediction**  
   Imputed test data, engineered features, and applied the final model for predictions.


We start by importing the necessary libraries and functions as following


```python
# Import basic necessary libraries
import numpy as np
import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns
import os
import random

# General functions for ML Workflows
from sklearn.model_selection import train_test_split # Splitting data
from sklearn.metrics import mean_squared_error, r2_score # Scoring functions

# Impute Estimated Average Stage Time
from sklearn.preprocessing import OneHotEncoder, StandardScaler 
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline

# Random Forest Regressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.multioutput import MultiOutputRegressor # RandomForest Regressor for Multiple Response Features

# Uncertainty Goodness
from UTuning import scorer, plots  # Cruz, Pyrcz (2021) version of calculating Uncertainty Goodness
from ozbayrak_goodness import goodness # Ozbayrak, Foster, Pyrcz (2025) version of calculating Uncertainty Goodness
from scipy.stats import norm # Also necessary for Ozbayrak, Foster, Pyrcz (2025) version subroutine

%matplotlib inline
```

## Pre-Process

We import data, and then we delete 3 entries where actual average stage time is less than or equal to zero (setting them to NaN). Then, we drop the column **Fleet Type**. We do this, because when we review data carefully, we notice that all Frac Fleets are performing only one type of Fleet Type. Hence, information-wise, the knowledge that a ML model can obtain from Fleet Type must be already contained within the Frac Fleet feature.


```python
# Import data
df = pd.read_csv('HackathonData2025.csv')

# Set AAST <=0 to NaN
df.loc[df['Actual Average Stage Time'] <= 0, 'Actual Average Stage Time'] = pd.NA

# Drop the 'Fleet Type' column
df = df.drop(columns=['Fleet Type'])
```

## Feature Engineering

### Impute Temperature

When the data is reviewed, it could be noted that the *consecutive entries* with *same padding* name and *increasing well number* will always have the same temperature. Based on this, it is possible to impute all NaN temperatures except two wells. These two wells are the only wells of the same padding in the consecutive entries. However, when these are visually inspected, it is obvious that they have the same temperature with the adjacent entries as well. So, we will set those two wells by hand, and impute the rest according to the mentioned rule.


```python
#  Extract "PadName" and numeric well number "WellNum"
#  Example well name: "Anderson 5H" -> PadName="Anderson", WellNum=5
#  We'll use two steps: first split into two columns, then remove the "H".
split_cols = df["Well Name"].str.rsplit(" ", n=1, expand=True)
df["PadName"] = split_cols[0]           # e.g. "Anderson"
df["WellSuffix"] = split_cols[1]        # e.g. "5H"

df["WellNum"] = (df["WellSuffix"]
                 .str.replace("H", "", regex=False)  # remove the letter H
                 .astype(int))                        # convert to integer

#  Define a new column 'PadGroup' that increments whenever
#  - Pad Name changes, OR
#  - Well number is NOT strictly larger than previous row's well number
#    (meaning if it repeats or goes backward, new group!)
df["PadGroup"] = (
    (df["PadName"] != df["PadName"].shift())  # pad changed
    | (df["WellNum"] <= df["WellNum"].shift()) # not strictly increasing
).cumsum()

df = df.drop(columns="WellSuffix")

# Now group by (PadName, PadGroup)
groups = df.groupby(["PadName", "PadGroup"])

# Impute all NaN temperatures by the group temperature
# All groups are visually inspected to have the same temperature.
# The only caveat occurs when the entire group has NaN for the temperature.
# We will separate those cases, and we will see that, luckily, those belong to the
# same temperature group with the adjacent entries.

all_nan_groups = []  # We'll store (pad, grp_id) for the groups with all NaN

for (pad, grp_id), sub_df in groups:
    # Check if it's fully NaN
    if sub_df["Ambient Temperature"].isna().all():
        # We'll fix this later by hand
        all_nan_groups.append((pad, grp_id))
    else:
        # Compute median ignoring NaN
        median_val = sub_df["Ambient Temperature"].median(skipna=True)
        
        # Fill the missing rows of this group with the median
        # Use .loc with the sub_df index so we only update those rows
        df.loc[sub_df.index, "Ambient Temperature"] = (
            df.loc[sub_df.index, "Ambient Temperature"]
              .fillna(median_val)
        )

# There are only 2 fully NaN groups, and
# each has only 1 well. We inspect them locally and notice
# that they belong to the same temperature group with the
# adjacent entries as we mentioned above. The obtained values are:
# ('Rich', 52):     49.7
# ('Flagler', 131): 70.5

manual_fixes = {
    ("Rich", 52): 49.7,
    ("Flagler", 131): 70.5
}

for (pad, grp_id), value in manual_fixes.items():
    # Identify those rows
    mask = (df["PadName"] == pad) & (df["PadGroup"] == grp_id)
    
    # Assign the chosen value
    df.loc[mask, "Ambient Temperature"] = value
```

### Impute EstAvgStT

We have initially built a model by simply discarding all the rows that contain NaN values, after imputing temperatures, and the resulting model yielded great accuracy ($R^{2}>0.95$). However, this model used Estimated Average Stage Time, and we knew that ~10% of Estimated Average Stage Time entries in both the training and the testing datasets were missing, so we needed a strategy to impute them with the features that exist in the both datasets. Due to time constraints, we aimed to create a fast but "good enough" model that will retain the good $R^{2}$ values.


```python
# Define target and features
target_col = "Estimated Average Stage Time"
feature_cols = ["Frac Fleet", "Target Formation", "Ambient Temperature", "Fuel Type"]

# Separate rows with and without NaN in the target
df_train_test = df.dropna(subset=[target_col])  # Rows with valid target
df_impute = df[df[target_col].isna()]  # Rows where target is NaN

# Separate features and target for training/testing
X = df_train_test[feature_cols]
y = df_train_test[target_col]

# Features for imputation
X_impute = df_impute[feature_cols]

# Identify categorical and numerical columns
categorical_cols = X.select_dtypes(include=["object"]).columns.tolist()
numerical_cols = X.select_dtypes(include=["number"]).columns.tolist()

# Preprocessing steps
numerical_transformer = StandardScaler()
categorical_transformer = OneHotEncoder(handle_unknown="ignore")

preprocessor = ColumnTransformer(
    transformers=[
        ("num", numerical_transformer, numerical_cols),
        ("cat", categorical_transformer, categorical_cols)
    ]
)

# Model
model = RandomForestRegressor(random_state=23, n_estimators=100)

# Pipeline
pipeline = Pipeline(steps=[
    ("preprocessor", preprocessor),
    ("model", model)
])

# Splitting data into train and test
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=23
)

# Fit a model using the pipeline
pipeline.fit(X_train, y_train)

# Predict on test set
y_pred = pipeline.predict(X_test)

# Evaluate model scores
mse = mean_squared_error(y_test, y_pred)
rmse = np.sqrt(mse)
r2 = r2_score(y_test, y_pred)

# Display model scores
print("Model Performance on Test Data:")
print(f"  RMSE: {rmse:.3f}")
print(f"  R^2 : {r2:.3f}")

```

    Model Performance on Test Data:
      RMSE: 9.332
      R^2 : 0.824


An $R^{2}$ of ~0.80 is sufficient for imputing this feature in the testing data. Furthermore, this $R^{2}$ is coming from the model that only uses the train split of the training data. For imputing the values, we then trained the same model with all available training data, and we impute the missing values with it.


```python
# Fit entire available data
pipeline.fit(X, y)

# Impute missing values for training data (processing of the testing data will be later)
imputed_values = pipeline.predict(X_impute)
df.loc[df[target_col].isna(), target_col] = imputed_values
```

### Engineer "Estimated Total Time"

We have observed the following:

- The power consumption is directly related to total pumped slurry volume by our domain knowledge.
- A model that has less features is always preferred, as it is going to be more robust and more interpretable. This is why, combining features into one feature while retaining their information is a great strategy.

Given these two, we have derived a feature named **Estimated Total Time**, which is obtained by multiplying Estimated Average Stage Time with Number of Stages. This gives a good metric of total time spend for the operation, which is a very good indicator of total pumped volume, hence the total power consumption. Also, by doing this, we have reduced 2 features that we were most certainly going to use to one. In the following parts of this workflow, we extensively test the robustness of the model due to this feature as well.


```python
# Create the new feature
df['Estimated Total Time'] = df['Estimated Average Stage Time'] * df['# Stages']
```

## Model Building

### Feature Ranking

Throughout this workflow, we will employ **MultiOutputRegressor**, which is a built-in algorithm for applying **Random Forest Regression** (Breiman, 2001) for multiple response features. We initially built a model with this pipeline, which yielded a great $R^{2}$. Then, we tried a vast collection of different combination of numerical and categorical features with the default hyperparameters. Here, for demonstration purposes, we only keep 5 of those, and we also test the robustness of the model that uses our engineered feature, Estimated Total Time. 

The way we tested these models built with different set of features is as follows: For each set, we have done a train-validate split, trained and validated the model for 100 different random seeds. We did this, because since the accuracies are very high, the randomness aspect was creating a difference in the accuracies independent of the model robustness, and to mitigate it, we used *law of large numbers* and run the same model for 100 different scenarios to observe the mean the accuracy converges to, and the distribution of accuracy. 

Our tests show that the model that uses our engineered feature and the least amount of other features was the most robust, with an extremely high $R^{2}$ around 0.97-0.99. After this, we didn't even tune for the hyperparameters, as this accuracy is good enough.


```python
# Define different feature sets to iterate over
feature_sets = [
    {
        "numerical": ["# Clusters ", "Estimated Total Time"],
        "categorical": ["Fuel Type", "Frac Fleet", "Target Formation"]
    },
    {
        "numerical": ["# Clusters ", "Ambient Temperature", "Estimated Total Time"],
        "categorical": ["Fuel Type", "Frac Fleet"]
    },
    {
        "numerical": ["Ambient Temperature", "Estimated Total Time"],
        "categorical": ["Fuel Type", "Target Formation"]
    },
    {
        "numerical": ["Ambient Temperature", "Actual Average Stage Time"],
        "categorical": ["Fuel Type", "Frac Fleet", "Target Formation"]
    },
    {
        "numerical": ["Ambient Temperature", "Estimated Total Time"],
        "categorical": ["Fuel Type", "Frac Fleet", "Target Formation"]
    },
]

# Store results
results = []

# Loop over feature sets
for i, feature_set in enumerate(feature_sets, start=1):
    print(f"\n=== Feature Set {i}: {feature_set} ===")

    # Encode categorical variables
    df_encoded = pd.get_dummies(df, columns=feature_set["categorical"], drop_first=False)

    # Define feature columns
    feature_cols = feature_set["numerical"]
    for col in df_encoded.columns:
        for cat in feature_set["categorical"]:
            if col.startswith(f"{cat}_"):
                feature_cols.append(col)

    # Define target columns
    Y = df_encoded[["Grid", "Diesel", "CNG"]]

    # Filter rows with no missing values in features and targets
    data = pd.concat([df_encoded[feature_cols], Y], axis=1).dropna()
    X = data[feature_cols]
    Y = data[["Grid", "Diesel", "CNG"]]

    # Loop over seeds
    for seed in range(1, 101):
        # Train-test split
        X_train, X_test, y_train, y_test = train_test_split(
            X, Y, test_size=0.2, random_state=seed
        )

        # Train multi-output random forest
        base_rf = RandomForestRegressor(n_estimators=100, random_state=seed)
        multi_rf = MultiOutputRegressor(base_rf)
        multi_rf.fit(X_train, y_train)

        # Predict
        y_pred = multi_rf.predict(X_test)
        y_pred = pd.DataFrame(y_pred, columns=["Grid_pred", "Diesel_pred", "CNG_pred"], index=y_test.index)

        # Calculate metrics
        for fuel_col in ["Grid", "Diesel", "CNG"]:
            true_vals = y_test[fuel_col]
            pred_vals = y_pred[f"{fuel_col}_pred"]
            r2 = r2_score(true_vals, pred_vals)

            # Append results
            results.append({
                "Feature Set": i,
                "Seed": seed,
                "Fuel": fuel_col,
                "R2": r2
            })

# Convert results to DataFrame
results_df = pd.DataFrame(results)

# Calculate mean R^2 for each feature set and fuel type
mean_r2_by_group = results_df.groupby(['Feature Set', 'Fuel'])['R2'].mean().reset_index()
print(mean_r2_by_group)

# Group by feature sets and fuel
combinations = results_df.groupby(["Feature Set", "Fuel"])

# Loop through combinations and create individual plots
for (feature_set, fuel), group in combinations:
    mean_r2 = group["R2"].mean()

    # Create a new figure for each combination
    plt.figure(figsize=(8, 6))

    # Plot histogram
    sns.histplot(group["R2"], bins=20, kde=True, color='blue', alpha=0.6)

    # Add a vertical line for the mean
    plt.axvline(mean_r2, color='red', linestyle='dashed', linewidth=1.5, label=f"Mean: {mean_r2:.3f}")

    # Add title, labels, and legend
    plt.title(f"R^2 Distribution for Feature Set {feature_set} ({fuel})", fontsize=14)
    plt.xlabel("R^2", fontsize=12)
    plt.ylabel("Frequency", fontsize=12)
    plt.legend(fontsize=10)

    # Adjust layout and show plot
    plt.tight_layout()
    plt.show()
```

    
    === Feature Set 1: {'numerical': ['# Clusters ', 'Estimated Total Time'], 'categorical': ['Fuel Type', 'Frac Fleet', 'Target Formation']} ===
    
    === Feature Set 2: {'numerical': ['# Clusters ', 'Ambient Temperature', 'Estimated Total Time'], 'categorical': ['Fuel Type', 'Frac Fleet']} ===
    
    === Feature Set 3: {'numerical': ['Ambient Temperature', 'Estimated Total Time'], 'categorical': ['Fuel Type', 'Target Formation']} ===
    
    === Feature Set 4: {'numerical': ['Ambient Temperature', 'Actual Average Stage Time'], 'categorical': ['Fuel Type', 'Frac Fleet', 'Target Formation']} ===
    
    === Feature Set 5: {'numerical': ['Ambient Temperature', 'Estimated Total Time'], 'categorical': ['Fuel Type', 'Frac Fleet', 'Target Formation']} ===
        Feature Set    Fuel        R2
    0             1     CNG  0.944201
    1             1  Diesel  0.964678
    2             1    Grid  0.984276
    3             2     CNG  0.963706
    4             2  Diesel  0.970336
    5             2    Grid  0.983226
    6             3     CNG  0.950178
    7             3  Diesel  0.960417
    8             3    Grid  0.991814
    9             4     CNG  0.924879
    10            4  Diesel  0.931667
    11            4    Grid  0.913974
    12            5     CNG  0.969549
    13            5  Diesel  0.975450
    14            5    Grid  0.991751



    
![png](/posts/2025-02-18-pge-hackathon-workflow/22_1.png)
    



    
![png](/posts/2025-02-18-pge-hackathon-workflow/22_2.png)
    



    
![png](/posts/2025-02-18-pge-hackathon-workflow/22_3.png)
    



    
![png](/posts/2025-02-18-pge-hackathon-workflow/22_4.png)
    



    
![png](/posts/2025-02-18-pge-hackathon-workflow/22_5.png)
    



    
![png](/posts/2025-02-18-pge-hackathon-workflow/22_6.png)
    



    
![png](/posts/2025-02-18-pge-hackathon-workflow/22_7.png)
    



    
![png](/posts/2025-02-18-pge-hackathon-workflow/22_8.png)
    



    
![png](/posts/2025-02-18-pge-hackathon-workflow/22_9.png)
    



    
![png](/posts/2025-02-18-pge-hackathon-workflow/22_10.png)
    



    
![png](/posts/2025-02-18-pge-hackathon-workflow/22_11.png)
    



    
![png](/posts/2025-02-18-pge-hackathon-workflow/22_12.png)
    



    
![png](/posts/2025-02-18-pge-hackathon-workflow/22_13.png)
    



    
![png](/posts/2025-02-18-pge-hackathon-workflow/22_14.png)
    



    
![png](/posts/2025-02-18-pge-hackathon-workflow/22_15.png)
    


### Training & Validation

Now, essentially the training of the model is over, as the "last" trained model is the one we want to retain, and Jupyter will keep that one. However, this is not very elegant, and that is why, we will train a single model and validate it in a dedicated cell for cleanliness. The process takes less than 5 seconds, so it is adequate. 


```python
# Use the obtained feature set from Feature Ranking step
feature_set = {
        "numerical": ["Ambient Temperature", "Estimated Total Time"],
        "categorical": ["Fuel Type", "Frac Fleet", "Target Formation"]
    }

# Store results
results = []

# Encode categorical variables
df_encoded = pd.get_dummies(df, columns=feature_set["categorical"], drop_first=False)

# Define feature columns
feature_cols = feature_set["numerical"]
for col in df_encoded.columns:
    for cat in feature_set["categorical"]:
        if col.startswith(f"{cat}_"):
            feature_cols.append(col)

# Define target columns
Y = df_encoded[["Grid", "Diesel", "CNG"]]

# Filter rows with no missing values in features and targets
data = pd.concat([df_encoded[feature_cols], Y], axis=1).dropna()
X = data[feature_cols]
Y = data[["Grid", "Diesel", "CNG"]]


# Train-test split
X_train, X_test, y_train, y_test = train_test_split(
    X, Y, test_size=0.2, random_state=23
)

# Train multi-output random forest
base_rf = RandomForestRegressor(n_estimators=100, random_state=23)
multi_rf = MultiOutputRegressor(base_rf)
multi_rf.fit(X_train, y_train)

# Predict
y_pred = multi_rf.predict(X_test)
y_pred = pd.DataFrame(y_pred, columns=["Grid_pred", "Diesel_pred", "CNG_pred"], index=y_test.index)
```

After the algorithmic part of training & validation is completed, we visualize the obtained results for inspection.


```python
# Combine test data + predictions
test_results = pd.concat([y_test, y_pred], axis=1)

# We need the real 'Fuel Type' (NOT the one-hot) for each row.
# Make sure the original df has an index that aligns with X_test / y_test.
# For simplicity, assume the original df has the same index before encoding.
# So we can do:
test_results["Fuel Type"] = df.loc[test_results.index, "Fuel Type"]

# Now we can group the test set by the actual Fuel Type
fuel_types = ["Grid","Diesel","Turbine","DGB"]
for ft in fuel_types:
    subset = test_results[test_results["Fuel Type"] == ft]
    if subset.empty:
        print(f"\nNo test samples for Fuel Type={ft}. Skipping plot.")
        continue
    
    print(f"\n=== Fuel Type = {ft}, #TestRows={len(subset)} ===")

    # We'll create a figure with 3 subplots: Grid, Diesel, CNG
    fig, axes = plt.subplots(1, 3, figsize=(15,5), sharey=False)
    fig.suptitle(f"Actual vs. Predicted for {ft} wells (Test Set)")

    # Helper function to scatter plot prediction vs truth
    def scatter_true_pred(ax, df_sub, fuel_name):
        true_col = f"{fuel_name}"
        pred_col = f"{fuel_name}_pred"
        ax.scatter(df_sub[true_col], df_sub[pred_col], alpha=0.7)
        # 1:1 line
        mn = min(df_sub[true_col].min(), df_sub[pred_col].min())
        mx = max(df_sub[true_col].max(), df_sub[pred_col].max())
        ax.plot([mn, mx], [mn, mx], color='red', linestyle='--', label='Ideal 1:1')
        ax.set_xlabel(f"Actual {fuel_name}")
        ax.set_ylabel(f"Predicted {fuel_name}")
        ax.legend()
        ax.set_title(fuel_name)

    # Plot each fuel
    scatter_true_pred(axes[0], subset, "Grid")
    scatter_true_pred(axes[1], subset, "Diesel")
    scatter_true_pred(axes[2], subset, "CNG")

    plt.tight_layout()
    plt.show()

# Calculate metrics for each fuel column
for i, fuel_col in enumerate(["Grid","Diesel","CNG"]):
    true_vals = y_test[fuel_col]
    pred_vals = y_pred[f"{fuel_col}_pred"]
    mse = mean_squared_error(true_vals, pred_vals)
    rmse = np.sqrt(mse)
    r2 = r2_score(true_vals, pred_vals)
    print(f"\nFUEL = {fuel_col}:")
    print(f"  RMSE = {rmse:.3f}")
    print(f"  R^2  = {r2:.3f}")
```

    
    === Fuel Type = Grid, #TestRows=3 ===



    
![png](/posts/2025-02-18-pge-hackathon-workflow/27_1.png)
    


    
    === Fuel Type = Diesel, #TestRows=87 ===



    
![png](/posts/2025-02-18-pge-hackathon-workflow/27_3.png)
    


    
    === Fuel Type = Turbine, #TestRows=66 ===



    
![png](/posts/2025-02-18-pge-hackathon-workflow/27_5.png)
    


    
    === Fuel Type = DGB, #TestRows=61 ===



    
![png](/posts/2025-02-18-pge-hackathon-workflow/27_7.png)
    


    
    FUEL = Grid:
      RMSE = 25119.557
      R^2  = 0.978
    
    FUEL = Diesel:
      RMSE = 8701.886
      R^2  = 0.970
    
    FUEL = CNG:
      RMSE = 2061.578
      R^2  = 0.936


#### Uncertainty Subroutine

Now, since we finished training our model, before using it for the prediction and uncertainty model building, we analyze and fine-tune it for uncertainty quantification. 

We will again use the training & validation splits, but this time for uncertainty model building instead of prediction. Since we have the real values for validation set, just like the prediction training, we can plot and calculate uncertainty goodness. Since there are different ways to calculate uncertainty goodness (the formula is the same and it is coming from Deutsch' Uncertainty Goodness, more information can be obtained from the manuscript (Deutsch, 1997), but there are different implementations, like Energy AI Hackathon 2024 version etc.), we will use two ways of doing it:

- UTuning package (Maldonado-Cruz and Pyrcz 2021): This is the most robust implementation available for Deutsch' Uncertainty Goodness
- $p-\xi(p)$ plot (Ozbayrak, Foster and Pyrcz, 2025): This is essentially the same plot, but instead of plotting $x=y$ and the uncertainty curve, the difference is plotted for easier numerical integration and visualization. When the curve is below the $x=y$ line, the obtained value is negative and when it is above the line, the obtained value is positive

We start by creating & storing the uncertainty distribution:


```python
import warnings
from sklearn.exceptions import DataConversionWarning
import pandas as pd
import numpy as np

# Suppress the specific UserWarning from sklearn
warnings.filterwarnings("ignore", category=UserWarning, module="sklearn")

# Store estimators without aggregation
grid_estimators = np.array([est.predict(X_test) for est in multi_rf.estimators_[0].estimators_]).T
diesel_estimators = np.array([est.predict(X_test) for est in multi_rf.estimators_[1].estimators_]).T
cng_estimators = np.array([est.predict(X_test) for est in multi_rf.estimators_[2].estimators_]).T

# Combine realizations into a DataFrame using pd.concat
# Create a list of Series for each type of estimator
columns = []
for i in range(100):
    columns.append(pd.Series(grid_estimators[:, i], name=f"Grid_R{i+1}"))
    columns.append(pd.Series(diesel_estimators[:, i], name=f"Diesel_R{i+1}"))
    columns.append(pd.Series(cng_estimators[:, i], name=f"CNG_R{i+1}"))

# Concatenate all columns at once
estimators_df = pd.concat(columns, axis=1)

# Add the corresponding index from X_test for traceability
estimators_df.index = X_test.index

# Create a DataFrame to store results
uncertainty_results = pd.DataFrame(index=estimators_df.index)

# Add Well Names as the first column
uncertainty_results["Well Name"] = df.loc[estimators_df.index, "Well Name"]

# Add the real fuel value (y_test) as the second column
fuel_values = []
for idx in y_test.index:
    fuel_type = df.loc[idx, "Fuel Type"]
    if fuel_type in ["DGB_CNG", "Turbine", "CNG"]:
        fuel_values.append(y_test.loc[idx, "CNG"])
    elif fuel_type in ["DGB_Diesel", "Diesel"]:
        fuel_values.append(y_test.loc[idx, "Diesel"])
    elif fuel_type == "Grid":
        fuel_values.append(y_test.loc[idx, "Grid"])
    elif fuel_type == "DGB":
        # Randomly choose between CNG and Diesel
        chosen_fuel = np.random.choice(["CNG", "Diesel"])
        fuel_values.append(y_test.loc[idx, chosen_fuel])
    else:
        raise ValueError(f"Unexpected fuel type: {fuel_type}")

uncertainty_results["Fuel Value"] = fuel_values

# Add the 100 estimators based on fuel type
for idx in estimators_df.index:
    fuel_type = df.loc[idx, "Fuel Type"]
    if fuel_type in ["DGB_CNG", "Turbine", "CNG"]:
        selected_columns = [f"CNG_R{i+1}" for i in range(100)]
    elif fuel_type in ["DGB_Diesel", "Diesel"]:
        selected_columns = [f"Diesel_R{i+1}" for i in range(100)]
    elif fuel_type == "Grid":
        selected_columns = [f"Grid_R{i+1}" for i in range(100)]
    elif fuel_type == "DGB":
        chosen_fuel = np.random.choice(["CNG", "Diesel"])
        selected_columns = [f"{chosen_fuel}_R{i+1}" for i in range(100)]
    else:
        raise ValueError(f"Unexpected fuel type: {fuel_type}")

    uncertainty_results.loc[idx, [f"R{i+1}" for i in range(100)]] = estimators_df.loc[idx, selected_columns].values
```

Then, we proceed with UTuning workflow


```python
# Collect the true values for the validation set
y_true = uncertainty_results['Fuel Value'].values  # Shape: (num_samples,)
R_columns = [f'R{i}' for i in range(1, 101)]
ens_preds = uncertainty_results[R_columns].values  # Shape: (num_samples, 100)

# Compute ensemble statistics
pred_mean = ens_preds.mean(axis=1)  # Mean prediction
knowledge_u = np.std(ens_preds, axis=1)  # Knowledge uncertainty (epistemic)

# Estimate data uncertainty (aleatoric) using residuals
residuals = y_true - pred_mean
data_u = np.std(residuals)  # Alternatively, use another appropriate method
Sigma = knowledge_u + data_u  # Total uncertainty

# Initialize the scorer with predictions, true values, and uncertainties
scorer_obj = scorer.scorer(pred_mean, y_true, Sigma)

# Compute the Indicator Function
IF_array = scorer_obj.IndicatorFunction()

# Compute Average Indicator Function
avgIF = np.mean(IF_array, axis=0)

# Define percentiles for plotting (e.g., 0%, 10%, ..., 100%)
n_quantiles = 11
perc = np.linspace(0.0, 1.00, n_quantiles)

# Plot Error Accuracy
plt.figure(figsize=(8, 6))
plots.error_accuracy_plot(perc, IF_array, pred_mean, y_true, Sigma)

# Enhance plot aesthetics
plt.title(f'Uncertainty Goodness Plot')
plt.xlabel('Percentile')
plt.ylabel('Accuracy')
plt.grid(True)

# Print Metrics
accuracy = scorer_obj.Accuracy()
precision = scorer_obj.Precision()
goodness_score = scorer_obj.Goodness()

print(f"  Accuracy = {accuracy:.2f}")
print(f"  Precision = {precision:.2f}")
print(f"  Goodness = {goodness_score:.2f}")
```

      Accuracy = 0.03
      Precision = 1.00
      Goodness = 0.95



    <Figure size 800x600 with 0 Axes>



    
![png](/posts/2025-02-18-pge-hackathon-workflow/32_2.png)
    


The plot coming from UTuning indicates a very good uncertainty modeling. The obtained curve is only *slightly below* $x=y$ line.

Next, $p-\xi(p)$ plot indicates also the same thing (negative area with a very small $y$ after $x\approx 0.3$)


```python
# Let's define a list for the R1..R100 columns:
pred_cols = [f"R{i}" for i in range(1, 101)]

# -------------------------------------------------------------------------
# Compute the CDF‐value for each well's true value
# -------------------------------------------------------------------------
cdf_values = []
for idx, row in uncertainty_results.iterrows():
    fuel_val = row["Fuel Value"]
    
    # Extract the 100 predictions from columns R1..R100
    preds = row[pred_cols].values  # or row[pred_cols].to_numpy()
    
    mean_ = np.mean(preds)
    std_  = np.std(preds)
    if std_ < 1e-12:
        std_ = 1e-12  # guard against zero std

    # Evaluate the Normal CDF of the well’s Fuel Value
    cdf_ = norm.cdf(fuel_val, loc=mean_, scale=std_)
    cdf_values.append(cdf_)

cdf_values = np.array(cdf_values)
N = len(cdf_values)

# -------------------------------------------------------------------------
# Build fraction_in vs. p for p in [0..1]
# -------------------------------------------------------------------------
p_intervals = np.linspace(0, 1, 20)  # e.g. 20 bins
fraction_in = np.zeros_like(p_intervals)

for i, p in enumerate(p_intervals):
    lower = 0.5 - 0.5 * p
    upper = 0.5 + 0.5 * p
    # fraction of wells whose cdf is in [lower, upper]
    frac = np.mean((cdf_values >= lower) & (cdf_values <= upper))
    fraction_in[i] = frac

# -------------------------------------------------------------------------
# Compute the overall Goodness for the entire dataset
# -------------------------------------------------------------------------
final_goodness = goodness(p_intervals, fraction_in,
                          return_plots=True, return_areas=True)

print("=== RESULTS ===")
print("Number of wells in CSV:", N)
print("p_intervals =", p_intervals)
print("fraction_in =", fraction_in)
print("Goodness =", final_goodness)
```


    
![png](/posts/2025-02-18-pge-hackathon-workflow/34_0.png)
    


    Integral of the positive part: 0.005314644846411448
    Integral of the negative part: 0.049586331419947706
    === RESULTS ===
    Number of wells in CSV: 217
    p_intervals = [0.         0.05263158 0.10526316 0.15789474 0.21052632 0.26315789
     0.31578947 0.36842105 0.42105263 0.47368421 0.52631579 0.57894737
     0.63157895 0.68421053 0.73684211 0.78947368 0.84210526 0.89473684
     0.94736842 1.        ]
    fraction_in = [0.         0.02764977 0.0875576  0.18894009 0.22580645 0.30875576
     0.34562212 0.36866359 0.41013825 0.46543779 0.50230415 0.5483871
     0.57603687 0.58525346 0.61751152 0.64976959 0.69585253 0.74193548
     0.76958525 1.        ]
    Goodness = 0.8955126923136931


Now, we will use the information from uncertainty goodness plot to improve our uncertainty modeling. Essentially, when the curve is below the $x=y$ line, it means that for a given percentile, we have less percentile of the true values in that probability interval, *which can be mitigated by keeping the mean (the prediction) the same but spreading the distribution by multiplying the variance with a scaling factor, which will increase the area of the probability for the same percentile*. The amount of this scaling factor is obtained entirely depending on how below the curve is. After a few trials that we try out of this workflow (and obtaining uncertainty goodness plots for both methods for 50 different random seeds to assure confidence in results), we obtain this scaling factor to be $1.15$


```python
# Helper function to rescale the uncertainty model
def rescale_predictions(preds, scale_factor):
    """
    Given original predictions (1D array), return a new array
    with the same mean but the std dev scaled by 'scale_factor'.
    """
    preds = np.asarray(preds)
    m = preds.mean()
    return m + scale_factor * (preds - m)

# Scaling the distribution variance
scale_factor = 1.15  
scaled_preds_all_wells = []

for well_idx in range(uncertainty_results.shape[0]):
    original_preds = uncertainty_results.iloc[well_idx][2:]  # shape (100,)
    new_preds = rescale_predictions(original_preds, scale_factor)
    scaled_preds_all_wells.append(new_preds)

uncertainty_results_scaled = uncertainty_results.copy(deep=True)
uncertainty_results_scaled.iloc[:,2:] = scaled_preds_all_wells
```

After the scaling is done, we re-calculate the uncertainty goodness as follows:


```python
cdf_values = []
for idx, row in uncertainty_results_scaled.iterrows():
    fuel_val = row["Fuel Value"]
    
    # Extract the 100 predictions from columns R1..R100
    preds = row[pred_cols].values  # or row[pred_cols].to_numpy()
    
    mean_ = np.mean(preds)
    std_  = np.std(preds)
    if std_ < 1e-12:
        std_ = 1e-12  # guard against zero std

    # Evaluate the Normal CDF of the well’s Fuel Value
    cdf_ = norm.cdf(fuel_val, loc=mean_, scale=std_)
    cdf_values.append(cdf_)

cdf_values = np.array(cdf_values)
N = len(cdf_values)

# -------------------------------------------------------------------------
# 4) Build fraction_in vs. p for p in [0..1]
# -------------------------------------------------------------------------
p_intervals = np.linspace(0, 1, 20)  # e.g. 20 bins
fraction_in = np.zeros_like(p_intervals)

for i, p in enumerate(p_intervals):
    lower = 0.5 - 0.5 * p
    upper = 0.5 + 0.5 * p
    # fraction of wells whose cdf is in [lower, upper]
    frac = np.mean((cdf_values >= lower) & (cdf_values <= upper))
    fraction_in[i] = frac

# -------------------------------------------------------------------------
# 5) Compute the overall Goodness for the entire dataset
# -------------------------------------------------------------------------
final_goodness = goodness(p_intervals, fraction_in,
                          return_plots=True, return_areas=True)

print("=== RESULTS ===")
print("Number of wells in CSV:", N)
print("p_intervals =", p_intervals)
print("fraction_in =", fraction_in)
print("Goodness =", final_goodness)
```


    
![png](/posts/2025-02-18-pge-hackathon-workflow/38_0.png)
    


    Integral of the positive part: 0.01927143835820452
    Integral of the negative part: 0.002114156358638578
    === RESULTS ===
    Number of wells in CSV: 217
    p_intervals = [0.         0.05263158 0.10526316 0.15789474 0.21052632 0.26315789
     0.31578947 0.36842105 0.42105263 0.47368421 0.52631579 0.57894737
     0.63157895 0.68421053 0.73684211 0.78947368 0.84210526 0.89473684
     0.94736842 1.        ]
    fraction_in = [0.         0.03686636 0.12903226 0.19815668 0.2718894  0.32718894
     0.3640553  0.41013825 0.46543779 0.51152074 0.55760369 0.57603687
     0.58986175 0.63133641 0.66359447 0.70967742 0.74193548 0.76497696
     0.78801843 1.        ]
    Goodness = 0.9765002489245184


As it can be observed, the uncertainty goodness has been increased from ~0.899 to 0.980 for this particular split. The average uncertainty goodness for 50 different splits have been estimated around ~0.91 before the scaling and ~0.935 after the scaling.


```python
# Plotting the histogram of normal vs scaled uncertainty models
# Create the figure and axes
plt.figure(figsize=(10, 6))

# Plot the histograms with enhancements
plt.hist(uncertainty_results.iloc[0][2:], bins=50, alpha=0.6, label='Uncertainty Results', color='blue', edgecolor='black')
plt.hist(uncertainty_results_scaled.iloc[0][2:], bins=50, alpha=0.6, label='Scaled Uncertainty Results', color='orange', edgecolor='black')

# Add titles and labels
plt.title('Comparison of Uncertainty Results', fontsize=16)
plt.xlabel('Value', fontsize=14)
plt.ylabel('Frequency', fontsize=14)

# Add a legend
plt.legend(fontsize=12)

# Add gridlines
plt.grid(axis='y', linestyle='--', alpha=0.7)

# Show the plot
plt.tight_layout()
plt.show()
```


    
![png](/posts/2025-02-18-pge-hackathon-workflow/40_0.png)
    


Now that we finished the model building, training, validation and fine-tuning for uncertainty modeling, we can finally use the entire training dataset (train + validation) and predict the testing dataset, and build the uncertainty model.


```python
# Train on entire dataset.
multi_rf.fit(X, Y)
print("\nFinal model trained on the entire dataset.")
```

    
    Final model trained on the entire dataset.


### Testing

Naturally, we have to do the same preprocessing and feature engineering on test data to have uniformity between train and test sets.

We start by imputing the temperatures. It is easily observed that some of the well groups with the same padding in the training data miss some wells, which are exactly the wells in testing data. Therefore, using the temperature from these well groups, which are again the same for all wells in a group, is very straightforward.

Then, we use our Estimated Average Stage Time imputing model to impute missing ones in the testing data, and we also create Estimated Total Time feature in the testing dataset.


```python
# Load the testing data
testing_df = pd.read_csv("testing_temperature_imputed.csv")

# Define features used in the trained model
feature_cols = ["Frac Fleet", "Target Formation", "Ambient Temperature", "Fuel Type"]

# Identify rows with missing 'Estimated Average Stage Time'
rows_to_impute = testing_df[testing_df["Estimated Average Stage Time"].isna()]

# Extract features for prediction
X_impute = rows_to_impute[feature_cols]

# Predict missing values using the trained pipeline
imputed_values = pipeline.predict(X_impute)

# Assign the predicted values back to the original DataFrame
testing_df.loc[rows_to_impute.index, "Estimated Average Stage Time"] = imputed_values

testing_df['Estimated Total Time'] = testing_df['Estimated Average Stage Time'] * testing_df['# Stages']
```

After the preprocessing and feature engineering is completed, we simply predict the testing data.


```python
# Define features used in the trained model
numerical_features = ["Ambient Temperature", "Estimated Total Time"]
categorical_features = ["Fuel Type", "Frac Fleet", "Target Formation"]

# Perform one-hot encoding on testing data
testing_encoded = pd.get_dummies(testing_df, columns=categorical_features, drop_first=False)

# Align testing data to have the same features as the trained model
missing_cols = set(X.columns) - set(testing_encoded.columns)
for col in missing_cols:
    testing_encoded[col] = 0  # Add missing columns with default values

# Reorder columns to match the training dataset
testing_encoded = testing_encoded[X.columns]

# Predict fuel columns using the trained model
fuel_predictions = multi_rf.predict(testing_encoded)

# Add predictions back to the original testing DataFrame
testing_df["Grid_pred"] = fuel_predictions[:, 0]
testing_df["Diesel_pred"] = fuel_predictions[:, 1]
testing_df["CNG_pred"] = fuel_predictions[:, 2]
```

After we do our prediction, we build our uncertainty model as well.


```python
# Suppress the sklearn UserWarning (optional, see notes below)
warnings.filterwarnings("ignore", category=UserWarning, module="sklearn")

# Extract individual estimators from the trained multi-output model
grid_estimators = multi_rf.estimators_[0].estimators_
diesel_estimators = multi_rf.estimators_[1].estimators_
cng_estimators = multi_rf.estimators_[2].estimators_

# Initialize lists to store predictions for each fuel type
grid_realizations = []
diesel_realizations = []
cng_realizations = []

# Loop through all estimators to generate predictions for testing data
for est in grid_estimators:
    grid_realizations.append(est.predict(testing_encoded))
for est in diesel_estimators:
    diesel_realizations.append(est.predict(testing_encoded))
for est in cng_estimators:
    cng_realizations.append(est.predict(testing_encoded))

# Convert to arrays for easier column-wise addition
grid_realizations = np.array(grid_realizations).T  # Shape: (n_samples, 100)
diesel_realizations = np.array(diesel_realizations).T
cng_realizations = np.array(cng_realizations).T

# Add realizations as columns to testing_df
for i in range(100):
    testing_df[f"Grid_R{i+1}"] = grid_realizations[:, i]
    testing_df[f"Diesel_R{i+1}"] = diesel_realizations[:, i]
    testing_df[f"CNG_R{i+1}"] = cng_realizations[:, i]

print("Added 100 realizations for each fuel type to testing_df.")
```

    Added 100 realizations for each fuel type to testing_df.


Last, we import the *solution.csv* to fill the result file in the desired format:


```python
# Load solution.csv for reference
solution_reference = pd.read_csv("solution.csv")

# Ensure well names are properly matched
solution_reference.rename(columns={"Masked Well Name": "Well Name"}, inplace=True)

# Initialize lists to store fuel values and realizations
fuel_values = []
realizations = []

# Iterate through each row in solution_reference to match and fill
for _, row in solution_reference.iterrows():
    well_name = row["Well Name"]  # Match well name
    required_fuel_type = row["Fuel Type"]  # Check fuel type required in solution_reference
    testing_row = testing_df.loc[testing_df["Well Name"] == well_name]
    
    if testing_row.empty:
        raise ValueError(f"Well Name '{well_name}' not found in testing_df.")
    
    # Handle DGB cases by checking the required fuel type
    if required_fuel_type in ["DGB_CNG", "Turbine"]:
        selected_fuel = "CNG"
        predictions = testing_row[[f"CNG_R{i+1}" for i in range(100)]].values[0]
    elif required_fuel_type in ["DGB_Diesel", "Diesel"]:
        selected_fuel = "Diesel"
        predictions = testing_row[[f"Diesel_R{i+1}" for i in range(100)]].values[0]
    elif required_fuel_type == "Grid":
        selected_fuel = "Grid"
        predictions = testing_row[[f"Grid_R{i+1}" for i in range(100)]].values[0]
    else:
        raise ValueError(f"Unexpected Fuel Type in solution_reference: {required_fuel_type}")

    # Append the selected fuel value and realizations
    fuel_values.append(selected_fuel)
    realizations.append(predictions)

# Add the realizations back to solution_reference
solution_reference["Fuel Value"] = [realizations[i].mean() for i in range(len(realizations))]

# Add R1 to R100 columns
for i in range(100):
    solution_reference[f"R_{i+1}"] = [realization[i] for realization in realizations]

# Ensure well names are properly matched
solution_reference.rename(columns={"Well Name": "Masked Well Name"}, inplace=True)

scaled_preds_all_wells = []
for well_idx in range(solution_reference.shape[0]):
    original_preds = solution_reference.iloc[well_idx][3:]  # shape (100,)
    new_preds = rescale_predictions(original_preds, scale_factor)
    scaled_preds_all_wells.append(new_preds)

solution_reference_scaled = solution_reference.copy(deep=True)
solution_reference_scaled.iloc[:,3:] = scaled_preds_all_wells

# Save the updated solution_reference
solution_reference_scaled.to_csv("solution.csv", index=False)
```

Before finishing, we plot 9 random predicted points along with the associated uncertainty models as histograms.

Thank you!


```python
# Sample 9 random rows from the dataset
sample_df = solution_reference_scaled.sample(9, random_state=42)

# Create the 3x3 subplot layout
fig, axes = plt.subplots(3, 3, figsize=(15, 15))
fig.suptitle('3x3 Histograms with KDE of Fuel Distributions', fontsize=18, weight='bold')

# Iterate through each sampled row and plot the histograms
for i, ax in enumerate(axes.flatten()):
    row = sample_df.iloc[i]
    fuel_value = row['Fuel Value']  # Aggregate value
    values = row.iloc[3:]  # Extract R1-R100 columns (assumes columns start at index 3)
    
    sns.histplot(
    values,
    bins=30,
    color='lightblue',
    edgecolor='black',
    stat='density',  # <-- key change
    ax=ax,
    linewidth=1,
    alpha=0.7
    )
    sns.kdeplot(
    values,
    ax=ax,
    color='black',
    linewidth=2
    )
    
    # Add vertical line for the Fuel Value
    ax.axvline(fuel_value, color='red', linestyle='--', linewidth=2, label=f'Fuel Value: {fuel_value:.2e}')
    
    # Title and labels
    ax.set_title(f"Well: {row['Masked Well Name']}\nFuel Type: {row['Fuel Type']}", fontsize=10, weight='bold')
    ax.set_xlabel('Values', fontsize=9)
    ax.set_ylabel('Frequency', fontsize=9)
    ax.legend(fontsize=8)
    ax.grid(alpha=0.4, linestyle='--')

plt.tight_layout(rect=[0, 0, 1, 0.96])  # Adjust layout to accommodate the suptitle
plt.show()

```


    
![png](/posts/2025-02-18-pge-hackathon-workflow/53_0.png)
    


Our model achieved 8% MAPE and 92% uncertainty goodness, which is #1 model in both rankings:


```python
rankings = pd.read_csv('team_rankings.csv')

rankings
```




<div>
<style scoped>
    .dataframe tbody tr th:only-of-type {
        vertical-align: middle;
    }

    .dataframe tbody tr th {
        vertical-align: top;
    }

    .dataframe thead th {
        text-align: right;
    }
</style>
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>Team Names</th>
      <th>MAPE</th>
      <th>Goodness Score</th>
      <th>Pres. Score</th>
      <th>Code Score</th>
      <th>MAPE Rank</th>
      <th>Goodness Rank</th>
      <th>Pres. Rank</th>
      <th>Code Rank</th>
      <th>Overall Rank</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>datacomrades</td>
      <td>0.081</td>
      <td>0.914</td>
      <td>37.166667</td>
      <td>24.0</td>
      <td>1.0</td>
      <td>1.0</td>
      <td>4.0</td>
      <td>2.0</td>
      <td>1.0</td>
    </tr>
    <tr>
      <th>1</th>
      <td>greenbayfrackers</td>
      <td>0.082</td>
      <td>0.528</td>
      <td>38.000000</td>
      <td>14.0</td>
      <td>2.0</td>
      <td>7.0</td>
      <td>2.0</td>
      <td>13.0</td>
      <td>2.0</td>
    </tr>
    <tr>
      <th>2</th>
      <td>teamname</td>
      <td>0.110</td>
      <td>0.911</td>
      <td>33.833333</td>
      <td>18.0</td>
      <td>3.0</td>
      <td>2.0</td>
      <td>12.0</td>
      <td>8.0</td>
      <td>3.0</td>
    </tr>
    <tr>
      <th>3</th>
      <td>chatpge</td>
      <td>0.171</td>
      <td>0.894</td>
      <td>39.833333</td>
      <td>12.5</td>
      <td>8.0</td>
      <td>3.0</td>
      <td>1.0</td>
      <td>15.0</td>
      <td>4.0</td>
    </tr>
    <tr>
      <th>4</th>
      <td>bayesian</td>
      <td>0.127</td>
      <td>0.565</td>
      <td>34.000000</td>
      <td>18.0</td>
      <td>4.0</td>
      <td>6.0</td>
      <td>10.0</td>
      <td>8.0</td>
      <td>5.0</td>
    </tr>
    <tr>
      <th>5</th>
      <td>one2tree</td>
      <td>0.128</td>
      <td>0.470</td>
      <td>35.166667</td>
      <td>14.5</td>
      <td>5.0</td>
      <td>9.0</td>
      <td>8.0</td>
      <td>12.0</td>
      <td>6.0</td>
    </tr>
    <tr>
      <th>6</th>
      <td>fractimus</td>
      <td>0.139</td>
      <td>0.428</td>
      <td>36.833333</td>
      <td>20.0</td>
      <td>6.0</td>
      <td>11.0</td>
      <td>6.0</td>
      <td>4.0</td>
      <td>7.0</td>
    </tr>
    <tr>
      <th>7</th>
      <td>kuobits</td>
      <td>0.192</td>
      <td>0.740</td>
      <td>31.500000</td>
      <td>25.0</td>
      <td>9.0</td>
      <td>4.0</td>
      <td>15.0</td>
      <td>1.0</td>
      <td>8.0</td>
    </tr>
    <tr>
      <th>8</th>
      <td>boil</td>
      <td>0.160</td>
      <td>0.070</td>
      <td>37.333333</td>
      <td>13.0</td>
      <td>7.0</td>
      <td>15.0</td>
      <td>3.0</td>
      <td>14.0</td>
      <td>9.0</td>
    </tr>
    <tr>
      <th>9</th>
      <td>forhire</td>
      <td>0.264</td>
      <td>0.568</td>
      <td>33.500000</td>
      <td>15.5</td>
      <td>12.0</td>
      <td>5.0</td>
      <td>14.0</td>
      <td>11.0</td>
      <td>10.0</td>
    </tr>
    <tr>
      <th>10</th>
      <td>deepblue</td>
      <td>0.489</td>
      <td>0.470</td>
      <td>35.500000</td>
      <td>18.5</td>
      <td>13.0</td>
      <td>9.0</td>
      <td>7.0</td>
      <td>7.0</td>
      <td>11.0</td>
    </tr>
    <tr>
      <th>11</th>
      <td>mlnewbies</td>
      <td>0.784</td>
      <td>0.482</td>
      <td>34.500000</td>
      <td>19.0</td>
      <td>14.0</td>
      <td>8.0</td>
      <td>9.0</td>
      <td>6.0</td>
      <td>12.0</td>
    </tr>
    <tr>
      <th>12</th>
      <td>orkahackers</td>
      <td>0.194</td>
      <td>0.370</td>
      <td>34.000000</td>
      <td>20.0</td>
      <td>10.0</td>
      <td>12.0</td>
      <td>10.0</td>
      <td>4.0</td>
      <td>13.0</td>
    </tr>
    <tr>
      <th>13</th>
      <td>pgehackathon2025datadrillers</td>
      <td>0.223</td>
      <td>0.118</td>
      <td>37.000000</td>
      <td>24.0</td>
      <td>11.0</td>
      <td>14.0</td>
      <td>5.0</td>
      <td>2.0</td>
      <td>14.0</td>
    </tr>
    <tr>
      <th>14</th>
      <td>gradientascent</td>
      <td>11.458</td>
      <td>0.119</td>
      <td>33.600000</td>
      <td>17.5</td>
      <td>15.0</td>
      <td>13.0</td>
      <td>13.0</td>
      <td>10.0</td>
      <td>15.0</td>
    </tr>
  </tbody>
</table>
</div>



## References

1- Breiman, “Random Forests”, Machine Learning, 45(1), 5-32, 2001.

2- Maldonado-Cruz, E., & Pyrcz, M. J. (2021). Tuning machine learning dropout for subsurface uncertainty model accuracy. Journal of Petroleum Science and Engineering, 205, 108975.

3- Ozbayrak, F., Foster, J. T., & Pyrcz, M. J. (2025). Spatial Bagging for Predictive Machine Learning Uncertainty Quantification. Preprint.

4- Deutsch, C. V. (1997). Direct assessment of local accuracy and precision. Geostatistics wollongong, 96(1), 115-125.

