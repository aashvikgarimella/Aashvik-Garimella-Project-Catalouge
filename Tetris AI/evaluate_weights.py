import os
import numpy as np
from game import Game      
from geneticSetup import Genetic_AI  

WEIGHTS_FOLDER = "weights/"      
EPISODES = 5                     

def evaluate_single_model(weight_file):
    weights = np.load(weight_file)
    agent = Genetic_AI(weights=weights)   

    total_rows = 0

    for _ in range(EPISODES):
        game = Game(mode="genetic", agent=agent)
        rows = game.run()  
        total_rows += rows

    avg_rows = total_rows / EPISODES
    return avg_rows


def main():
    results = []

    for file in os.listdir(WEIGHTS_FOLDER):
        if file.endswith(".npy"):
            full_path = os.path.join(WEIGHTS_FOLDER, file)
            print(f"Evaluating: {file}")
            score = evaluate_single_model(full_path)
            results.append((file, score))

    
    results.sort(key=lambda x: x[1], reverse=True)

    print("\n=== LEADERBOARD ===")
    for file, score in results:
        print(f"{file}: {score:.2f} avg rows")

    # save leaderboard
    np.save("model_leaderboard.npy", results)

if __name__ == "__main__":
    main()
