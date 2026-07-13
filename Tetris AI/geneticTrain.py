import numpy as np
from geneticAlgorithm import GeneticAlgorithm
from geneticSetup import Genetic_AI
from game import Game
from piece import Piece


def main():
    ga = GeneticAlgorithm(
        population_size=40,
        generations=30,
        mutation_rate=0.3,
        tournament_size=3,
    )

    best_weights = ga.run()
    np.save("best_genetic_weights.npy", best_weights)
    print("Saved best weights to best_genetic_weights.npy")

    ai = Genetic_AI(best_weights)
    game = Game(mode="genetic", agent=ai)
    pieces, rows = game.run_no_visual()
    print(f"Test run -> pieces dropped: {pieces}, rows cleared: {rows}")


if __name__ == "__main__":
    main()
