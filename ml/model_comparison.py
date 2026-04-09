import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (accuracy_score, precision_score, recall_score,
                             f1_score, roc_auc_score, confusion_matrix,
                             classification_report, roc_curve)
import matplotlib
matplotlib.use('Agg')          # non-interactive backend
import matplotlib.pyplot as plt
import os
import warnings
warnings.filterwarnings('ignore')

# ── Paths ─────────────────────────────────────────────────────
DATA_PATH   = os.path.join(os.path.dirname(__file__), "..", "data", "heart_disease_uci.csv")
OUTPUT_DIR  = os.path.join(os.path.dirname(__file__), "..", "outputs")

# ── Data Loading ──────────────────────────────────────────────
def load_and_preprocess():
    print("Training models...\n")
    df = pd.read_csv(DATA_PATH)

    df["has_disease"] = (df["num"] > 0).astype(int)
    df = df.dropna(subset=["thal", "ca", "slope"])

    cat_cols = ["sex", "cp", "fbs", "restecg", "exang", "slope", "ca", "thal"]
    num_cols = ["age", "trestbps", "chol", "thalch", "oldpeak"]

    X_cat = pd.get_dummies(df[cat_cols], columns=cat_cols, drop_first=False)
    X_num = df[num_cols].fillna(df[num_cols].mean())
    X = pd.concat([X_cat, X_num], axis=1)
    y = df["has_disease"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42)

    scaler = StandardScaler()
    X_train.loc[:, num_cols] = scaler.fit_transform(X_train[num_cols])
    X_test.loc[:, num_cols]  = scaler.transform(X_test[num_cols])

    return X_train, X_test, y_train, y_test

# ── Evaluation (prints – unchanged format) ────────────────────
def evaluate_model(name, model, X_test, y_test):
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1] if hasattr(model, 'predict_proba') else None

    acc  = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, zero_division=0)
    rec  = recall_score(y_test, y_pred, zero_division=0)
    f1   = f1_score(y_test, y_pred, zero_division=0)
    roc  = roc_auc_score(y_test, y_prob) if y_prob is not None else 0.0
    cm   = confusion_matrix(y_test, y_pred)
    cr   = classification_report(y_test, y_pred)

    print("=" * 60)
    print(name)
    print("=" * len(name) + "\n")
    print(f"Accuracy  : {acc:.4f}")
    print(f"Precision : {prec:.4f}")
    print(f"Recall    : {rec:.4f}")
    print(f"F1 Score  : {f1:.4f}")
    print(f"ROC-AUC   : {roc:.4f}\n")
    print("Confusion Matrix:")
    if cm.shape == (2, 2):
        print(f"TN={cm[0,0]:<5} FP={cm[0,1]:<5}")
        print(f"FN={cm[1,0]:<5} TP={cm[1,1]:<5}\n")
    else:
        print(cm, "\n")
    print("Classification Report:")
    print(cr)

    return {
        'Accuracy': acc, 'Precision': prec, 'Recall': rec,
        'F1': f1, 'ROC-AUC': roc, 'cm': cm, 'y_pred': y_pred, 'y_prob': y_prob
    }


# ══════════════════════════════════════════════════════════════
# CHART GENERATION (added – does NOT alter terminal output)
# ══════════════════════════════════════════════════════════════

def _ensure_output_dir():
    os.makedirs(OUTPUT_DIR, exist_ok=True)


def plot_accuracy_comparison(results):
    """Step 1 – simple accuracy bar chart."""
    _ensure_output_dir()
    names = list(results.keys())
    accs  = [results[n]['Accuracy'] for n in names]

    fig, ax = plt.subplots(figsize=(8, 5))
    bars = ax.bar(names, accs)
    ax.set_title("Model Accuracy Comparison", fontsize=14, fontweight='bold')
    ax.set_ylabel("Accuracy")
    ax.set_ylim(0, 1.05)
    for bar, acc in zip(bars, accs):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.01,
                f"{acc:.4f}", ha='center', va='bottom', fontweight='bold')
    fig.tight_layout()
    fig.savefig(os.path.join(OUTPUT_DIR, "accuracy_comparison.png"), dpi=150)
    plt.close(fig)


def plot_metrics_comparison(results):
    """Step 2 – grouped bar chart for all five metrics."""
    _ensure_output_dir()
    metrics = ['Accuracy', 'Precision', 'Recall', 'F1', 'ROC-AUC']
    names   = list(results.keys())
    x       = np.arange(len(metrics))
    width   = 0.25

    fig, ax = plt.subplots(figsize=(10, 6))
    for i, name in enumerate(names):
        vals = [results[name][m] for m in metrics]
        ax.bar(x + i * width, vals, width, label=name)

    ax.set_title("Multi-Metric Model Comparison", fontsize=14, fontweight='bold')
    ax.set_ylabel("Score")
    ax.set_xticks(x + width)
    ax.set_xticklabels(metrics)
    ax.set_ylim(0, 1.1)
    ax.legend()
    fig.tight_layout()
    fig.savefig(os.path.join(OUTPUT_DIR, "metrics_comparison.png"), dpi=150)
    plt.close(fig)


def plot_roc_curves(results, y_test):
    """Step 3 – ROC curves for every model."""
    _ensure_output_dir()
    fig, ax = plt.subplots(figsize=(8, 6))
    for name, r in results.items():
        if r['y_prob'] is not None:
            fpr, tpr, _ = roc_curve(y_test, r['y_prob'])
            ax.plot(fpr, tpr, label=f"{name} (AUC = {r['ROC-AUC']:.4f})")
    ax.plot([0, 1], [0, 1], 'k--', alpha=0.4)
    ax.set_title("ROC Curve Comparison", fontsize=14, fontweight='bold')
    ax.set_xlabel("False Positive Rate")
    ax.set_ylabel("True Positive Rate")
    ax.legend(loc='lower right')
    fig.tight_layout()
    fig.savefig(os.path.join(OUTPUT_DIR, "roc_curve.png"), dpi=150)
    plt.close(fig)


def plot_confusion_matrices(results):
    """Step 4 – one heatmap per model."""
    _ensure_output_dir()
    for name, r in results.items():
        cm = r['cm']
        fig, ax = plt.subplots(figsize=(5, 4))
        im = ax.imshow(cm, interpolation='nearest', cmap=plt.cm.Blues)
        ax.figure.colorbar(im, ax=ax)
        ax.set(xticks=[0, 1], yticks=[0, 1],
               xticklabels=['No Disease', 'Disease'],
               yticklabels=['No Disease', 'Disease'],
               xlabel='Predicted', ylabel='Actual',
               title=f'Confusion Matrix – {name}')
        for i in range(2):
            for j in range(2):
                ax.text(j, i, str(cm[i, j]),
                        ha='center', va='center',
                        color='white' if cm[i, j] > cm.max() / 2 else 'black',
                        fontsize=16, fontweight='bold')
        fig.tight_layout()
        safe_name = name.lower().replace(' ', '_')
        fig.savefig(os.path.join(OUTPUT_DIR, f"confusion_matrix_{safe_name}.png"), dpi=150)
        plt.close(fig)


def plot_feature_importance(trained_models, feature_names):
    """Step 5 – coefficients for LR, feature_importances_ for RF."""
    _ensure_output_dir()

    fig, axes = plt.subplots(1, 2, figsize=(16, 7))

    # Logistic Regression coefficients
    lr = trained_models['Logistic Regression']
    coefs = lr.coef_[0]
    sorted_idx = np.argsort(np.abs(coefs))[-15:]  # top 15
    axes[0].barh(np.array(feature_names)[sorted_idx], coefs[sorted_idx])
    axes[0].set_title("Logistic Regression – Top 15 Coefficients", fontsize=12, fontweight='bold')
    axes[0].set_xlabel("Coefficient Value")

    # Random Forest importances
    rf = trained_models['Random Forest']
    importances = rf.feature_importances_
    sorted_idx = np.argsort(importances)[-15:]
    axes[1].barh(np.array(feature_names)[sorted_idx], importances[sorted_idx])
    axes[1].set_title("Random Forest – Top 15 Feature Importances", fontsize=12, fontweight='bold')
    axes[1].set_xlabel("Importance")

    fig.tight_layout()
    fig.savefig(os.path.join(OUTPUT_DIR, "feature_importance.png"), dpi=150)
    plt.close(fig)


# ── Main ──────────────────────────────────────────────────────
def main():
    X_train, X_test, y_train, y_test = load_and_preprocess()

    models = {
        "Logistic Regression": LogisticRegression(max_iter=1000, random_state=42),
        "Decision Tree":       DecisionTreeClassifier(random_state=42, max_depth=5),
        "Random Forest":       RandomForestClassifier(random_state=42, n_estimators=100)
    }

    results = {}
    trained_models = {}
    for name, model in models.items():
        model.fit(X_train, y_train)
        trained_models[name] = model
        results[name] = evaluate_model(name, model, X_test, y_test)

    # ── Terminal comparison table (unchanged format) ──────────
    print("=" * 60)
    print("MODEL COMPARISON SUMMARY")
    print("========================")
    print("\nModel                       Accuracy  Precision     Recall         F1    ROC-AUC\n")

    for name in ["Logistic Regression", "Decision Tree", "Random Forest"]:
        m = results[name]
        print(f"{name:<27} {m['Accuracy']:.4f}     {m['Precision']:.4f}     {m['Recall']:.4f}     {m['F1']:.4f}     {m['ROC-AUC']:.4f}")

    print("\n" + "=" * 60)
    print("WHY LOGISTIC REGRESSION IS PREFERRED")
    print("====================================")
    print("\n1. Interpretability: Unlike 'black box' models like Random Forest, Logistic Regression provides clear coefficients, enabling feature-level explainability (SHAP-style) critical for medical applications.")
    print("2. Probability Output: It accurately calibrates predicted probabilities, mapping directly to a smooth clinical risk score rather than hard classifications.")
    print("3. Clinical Trust: Logistic Regression is deeply established in standard clinical nomograms, making it more robust against overfitting and easier for cardiologists to audit.")
    print("4. Explainability: It directly powers our 'Explainable AI' module because the linear mapping allows us to pinpoint exactly which patient inputs raised or lowered the risk.")
    print("5. Efficiency: The inference requires negligible compute or memory overhead, making it ideal for edge devices and IoT (e.g., ESP32 ECG monitoring) integration.\n")

    # ── Generate & save all charts ────────────────────────────
    print("=" * 60)
    print("GENERATING CHARTS...")
    print("=" * 60 + "\n")

    plot_accuracy_comparison(results)
    print("  [OK] Saved: outputs/accuracy_comparison.png")

    plot_metrics_comparison(results)
    print("  [OK] Saved: outputs/metrics_comparison.png")

    plot_roc_curves(results, y_test)
    print("  [OK] Saved: outputs/roc_curve.png")

    plot_confusion_matrices(results)
    for name in results:
        safe = name.lower().replace(' ', '_')
        print(f"  [OK] Saved: outputs/confusion_matrix_{safe}.png")

    plot_feature_importance(trained_models, list(X_train.columns))
    print("  [OK] Saved: outputs/feature_importance.png")

    print(f"\nAll charts saved to: {os.path.abspath(OUTPUT_DIR)}\n")


if __name__ == "__main__":
    main()
