import joblib
import pandas as pd
from homeharvest import scrape_property
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_percentage_error
from sklearn.model_selection import train_test_split

FEATURES = [
    "zip_code", "beds", "full_baths", "half_baths",
    "sqft", "lot_sqft", "neighborhoods", "stories",
]
TARGET = "sold_price"
MODEL_PATH = "housing_price_model.joblib"


def load_data(path="HousingData.csv"):
    return pd.read_csv(path)


def build_matrix(data):
    X = pd.get_dummies(data[FEATURES]).dropna()
    y = data[TARGET].loc[X.index]
    return X, y


def train(data):
    X, y = build_matrix(data)
    X_train, X_valid, y_train, y_valid = train_test_split(
        X, y, train_size=0.8, test_size=0.2, random_state=4
    )
    model = RandomForestRegressor(
        n_estimators=300,
        max_depth=None,
        min_samples_split=2,
        min_samples_leaf=1,
        random_state=4,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)
    accuracy = 1 - mean_absolute_percentage_error(y_valid, model.predict(X_valid))
    print(f"Model Accuracy: {accuracy:.2%}")
    joblib.dump((model, X.columns), MODEL_PATH)
    return model


if __name__ == "__main__":
    train(load_data())
