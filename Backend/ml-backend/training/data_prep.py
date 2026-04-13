from sklearn.model_selection import train_test_split
import pandas as pd
from datasets import DatasetDict, Dataset
df = pd.read_csv("clausedocs/dataset.csv")
df = df.dropna()

df["risk_severity"] = df["risk_severity"].str.lower()

category_map = {
    'Policy change risk': 0,
    'Personal data usage': 1,
    'Data security and Liability': 2,
    'Rule usage enforcement': 3,
    'Account responsibility': 4,
    'Account termination risk': 5,
    'Third party dependency risk': 6,
    'Legal remedy limitation': 7,
    'Change of service risk': 8,
    'Access restriction': 9,
    'Financial commitment risk': 10,
    'User content rights risk': 11,
    'Future scope expansion': 12,
    'Irrevocable rights': 13,
    'Jurisdiction risk': 14,
}

df1=df

severity_map = {
    "none":0,
    "low":1,
    "medium": 2,
    "high": 3,
}

df["category_label"] = df["risk_category"].map(category_map)
df["severity_label"] = df["risk_severity"].map(severity_map)

print(df["category_label"].isna().sum())
print(df["severity_label"].isna().sum())

df = df.dropna(subset=["category_label", "severity_label"])

df["stratify_key"] = df["category_label"].astype(str) + "_" + df["severity_label"].astype(str)

# Initial filter — keep classes with at least 2 members
counts = df["stratify_key"].value_counts()
rare_keys = counts[counts < 2].index
df = df[~df["stratify_key"].isin(rare_keys)]

# First split
train_df, temp_df = train_test_split(
    df,
    test_size=0.25,
    stratify=df["stratify_key"],
    random_state=42
)

# Find classes in temp_df that have fewer than 2 members — move them to train
temp_counts = temp_df["stratify_key"].value_counts()
rare_in_temp = temp_counts[temp_counts < 2].index

# Move rare rows from temp_df into train_df
rows_to_move = temp_df[temp_df["stratify_key"].isin(rare_in_temp)]
train_df = pd.concat([train_df, rows_to_move], ignore_index=True)
temp_df = temp_df[~temp_df["stratify_key"].isin(rare_in_temp)].reset_index(drop=True)

print("Min class count in temp_df:", temp_df["stratify_key"].value_counts().min())

# Second split — now safe
valid_df, test_df = train_test_split(
    temp_df,
    test_size=0.4,
    stratify=temp_df["stratify_key"],
    random_state=42
)

# Reset index and cleanup
train_df.reset_index(drop=True, inplace=True)
valid_df.reset_index(drop=True, inplace=True)
test_df.reset_index(drop=True, inplace=True)

train_df = train_df.drop(columns=["stratify_key"])
valid_df = valid_df.drop(columns=["stratify_key"])
test_df = test_df.drop(columns=["stratify_key"])

print(f"Train: {len(train_df)}, Valid: {len(valid_df)}, Test: {len(test_df)}")

from datasets import Dataset, DatasetDict

dataset_dict = DatasetDict({
    "train": Dataset.from_pandas(train_df),
    "validation": Dataset.from_pandas(valid_df),
    "test": Dataset.from_pandas(test_df)
})

print(df["risk_category"].unique())