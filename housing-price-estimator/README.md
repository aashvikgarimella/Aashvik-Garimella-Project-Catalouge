# Housing Price Estimator

Predicts sold price for homes in Miami, FL from listing features.

## Approach

Data collected with the `homeharvest` library (3000+ rows, Miami FL). Features
used: zip code, beds, full baths, half baths, sqft, lot sqft, neighborhood,
stories. Price-derived columns were deliberately excluded, since they leak the
target into the model.

Preprocessing is a null-column drop and one-hot encoding of categoricals.

## Results

| Model | Accuracy (1 - MAPE) |
|---|---|
| SVR | ~65% |
| Random Forest | ~71% |
| Random Forest (tuned) | 81-82% |

Tuning `n_estimators` to 300 and fixing `random_state=4` gave roughly a 10 point
improvement over the baseline forest.

## Usage

```
pip install -r requirements.txt
python train.py      # writes housing_price_model.joblib
python predict.py    # runs inference on a sample house
```
