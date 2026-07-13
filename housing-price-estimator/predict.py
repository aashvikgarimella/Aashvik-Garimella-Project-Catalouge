import joblib
import pandas as pd

MODEL_PATH = "housing_price_model.joblib"


def inference(model_path, house):
    model, train_columns = joblib.load(model_path)
    encoded = pd.get_dummies(house).reindex(columns=train_columns, fill_value=0)
    prediction = model.predict(encoded)[0]
    return f"Predicted Price for the New House: ${prediction:,.2f}"


if __name__ == "__main__":
    test_house = pd.DataFrame({
        "zip_code": [33176],
        "beds": [3.0],
        "full_baths": [2.0],
        "half_baths": [1.0],
        "sqft": [3525],
        "lot_sqft": [0],
        "neighborhoods": ["Brickell"],
        "stories": [1.0],
    })
    print(inference(MODEL_PATH, test_house))
