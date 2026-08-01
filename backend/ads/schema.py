'''
checking what type fo data the column stores
'''
import pandas as pd

num = "numeric"
cat = "categorical"
boolean = "boolean"
date_time = "datetime"
text = "text"
identifier = "identifier"
const = "constant"
empty = "empty"

modelable = [num, cat, boolean, date_time]

boolean_words = ["true", "false", "yes", "no", "y", "n", "t", "f", "0", "1"]

def column_kind(series):

    values = series.dropna()
    if len(values) == 0:
        return empty, "no value is availble"
    
    n_unique = values.nunique()
    if n_unique == 1:
        return "only ne distinct value"
    
    if pd.api.types.is_bool_dtype(series):
        return boolean, "stored as boolean"
    
    if pd.api.types.is_datetime64_any_dtype(series):
        return date_time, "stored as date time"
    
    if pd.api.types.is_numeric_dtype(series):
        return check_numeric(values, n_unique)
    
    return check_text(values, n_unique)

def check_numeric(values, n_unique):

    if n_unique == 2 and set(values.unique()) <= {0,1}:
        return boolean, "only 0 and 1"
    
    is_integer = pd.api.types.is_integer_dtype(values)
    if is_integer and n_unique == len(values) and len(values) > 20:
        return identifier, "each row has different integer"
    
    if is_integer and n_unique <= 10:
        return cat, "integer with only %d different values" % n_unique
    
    return num, "%d different numric values" %n_unique

def check_text(values, n_unique):

    text = values.astype(str)
    if n_unique <= 2:
        words = set(v.strip().lower() for v in text.unique())
        if words.issubset(set(boolean_words)):
            return boolean, "boolean type"
            
    sample = text.head(1000)
    if check_if_dates(sample):
        return date_time, "date-time value"
    
    if n_unique / len(values) <= .5 and n_unique <= 200:
        return cat, "%d different values in %d different rows" % (n_unique, len(values))
    
    average_length = sample.str.len().mean()
    if average_length >= 25:
        return text, "different texts"
    
    return identifier, "%d different values" % (n_unique)

def check_if_dates(sample):
    all_numbers = sample.str.match(r"^\s*-?\d+\.?\d*\s*$").fillna(False).all()
    if all_numbers:
        return False

    parsed = pd.to_datetime(sample, errors="coerce", format="mixed")
    return parsed.notna().mean() >= 0.85