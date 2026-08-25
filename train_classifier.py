
import pickle

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix
)
import numpy as np


data_dict = pickle.load(open('./data.pickle', 'rb'))

data = np.array(data_dict['data'], dtype=object)
labels = np.asarray(data_dict['labels'])
data = [list(i) for i in data]  # convert arrays to lists
max_len = max(len(i) for i in data)

data = np.array([i + [0]*(max_len - len(i)) for i in data])

x_train, x_test, y_train, y_test = train_test_split(data, labels, test_size=0.2, shuffle=True, stratify=labels, random_state=42)

model = RandomForestClassifier()

model.fit(x_train, y_train)

y_predict = model.predict(x_test)

# Model Evaluation
accuracy = accuracy_score(y_test, y_predict)
precision = precision_score(
    y_test,
    y_predict,
    average='weighted',
    zero_division=0
)
recall = recall_score(
    y_test,
    y_predict,
    average='weighted',
    zero_division=0
)
f1 = f1_score(
    y_test,
    y_predict,
    average='weighted',
    zero_division=0
)

print("Accuracy  :", accuracy * 100, "%")
print("Precision :", precision * 100, "%")
print("Recall    :", recall * 100, "%")
print("F1 Score  :", f1 * 100, "%")

# Confusion Matrix
cm = confusion_matrix(y_test, y_predict)

print("\nConfusion Matrix:")
print(cm)


f = open('model.p', 'wb')
pickle.dump({'model': model}, f)
f.close()
