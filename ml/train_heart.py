"""
Train a logistic regression model for heart disease prediction using the provided
UCI-style dataset. The script outputs a JSON artifact with everything needed for
JavaScript inference (coefficients, intercept, one-hot categories, and scaler
parameters). No pickled objects are used so the Node server can stay dependency‑light.
"""

import json
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.impute import SimpleImputer

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "heart_disease_uci.csv"
OUTPUT_PATH = ROOT / "server" / "model" / "heart_model.json"


def main() -> None:
    df = pd.read_csv(DATA_PATH)

    # Binary target: 1 = any heart disease, 0 = healthy
    df["has_disease"] = (df["num"] > 0).astype(int)
    target = df["has_disease"]

    feature_cols = [
        "age",
        "sex",
        "cp",
        "trestbps",
        "chol",
        "fbs",
        "restecg",
        "thalch",
        "exang",
        "oldpeak",
        "slope",
        "ca",
        "thal",
    ]
    data = df[feature_cols]

    cat_cols = ["sex", "cp", "fbs", "restecg", "exang", "slope", "ca", "thal"]
    num_cols = [c for c in feature_cols if c not in cat_cols]

    cat_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
        ]
    )
    num_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )

    preprocessor = ColumnTransformer(
        [
            ("cat", cat_transformer, cat_cols),
            ("num", num_transformer, num_cols),
        ]
    )

    model = LogisticRegression(max_iter=1000, solver="lbfgs")

    clf = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("model", model),
        ]
    )

    X_train, X_test, y_train, y_test = train_test_split(
        data, target, test_size=0.2, random_state=42, stratify=target
    )
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)
    y_prob = clf.predict_proba(X_test)[:, 1]

    acc = accuracy_score(y_test, y_pred)
    roc_auc = roc_auc_score(y_test, y_prob)

    # Extract model pieces for JS inference
    ohe: OneHotEncoder = (
        clf.named_steps["preprocessor"]
        .named_transformers_["cat"]
        .named_steps["encoder"]
    )
    scaler: StandardScaler = (
        clf.named_steps["preprocessor"].named_transformers_["num"].named_steps["scaler"]
    )
    log_reg: LogisticRegression = clf.named_steps["model"]

    feature_names = clf.named_steps["preprocessor"].get_feature_names_out().tolist()

    artifact = {
        "created_at": datetime.utcnow().isoformat() + "Z",
        "source_data": str(DATA_PATH),
        "target": "has_disease",
        "classes": log_reg.classes_.tolist(),
        "metrics": {
            "accuracy": acc,
            "roc_auc": roc_auc,
            "test_size": len(X_test),
        },
        "categorical_features": {
            name: cats.tolist()
            for name, cats in zip(cat_cols, ohe.categories_)
        },
        "numeric_features": num_cols,
        "numeric_mean": scaler.mean_.tolist(),
        "numeric_scale": scaler.scale_.tolist(),
        "feature_names": feature_names,
        "coefficients": log_reg.coef_[0].tolist(),
        "intercept": log_reg.intercept_[0],
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(artifact, f, indent=2)

    print(f"Model saved to {OUTPUT_PATH}")
    print(f"Accuracy: {acc:.3f}, ROC-AUC: {roc_auc:.3f}")


if __name__ == "__main__":
    main()
