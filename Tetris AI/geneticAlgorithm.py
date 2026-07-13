from geneticSetup import Genetic_AI
from game import Game
import random
import numpy as np


class GeneticAlgorithm:
    def __init__(
        self,
        population_size=50,
        generations=50,
        mutation_rate=0.1,
        tournament_size=3,
    ):
        self.population_size = population_size
        self.generations = generations
        self.mutation_rate = mutation_rate
        self.tournament_size = tournament_size

    

    def initialize_population(self):
        return [np.random.uniform(-1, 1, 4) for _ in range(self.population_size)]

    

    def fitness(self, weights):
        ai = Genetic_AI(weights)
        game = Game(mode="genetic", agent=ai)

        
        pieces_dropped, rows_cleared = game.run_no_visual()

        

        return float(rows_cleared)

    def select_parents(self, population, fitness_scores):
        parents = []
        paired = list(zip(population, fitness_scores))

        for _ in range(self.population_size):
            # Pick a few random participants
            contenders = random.sample(paired, self.tournament_size)
            # Best fitness wins the tournament
            winner = max(contenders, key=lambda x: x[1])[0]
            parents.append(winner)
        return parents

    def crossover(self, parent1, parent2, crossover_rate=0.7):
        p1 = np.array(parent1, dtype=float)
        p2 = np.array(parent2, dtype=float)

        if random.random() > crossover_rate:
            return p1.copy(), p2.copy()

        point = random.randint(1, len(p1) - 1)
        child1 = np.concatenate([p1[:point], p2[point:]])
        child2 = np.concatenate([p2[:point], p1[point:]])
        return child1, child2

    def mutate(self, weights):
        w = np.array(weights, dtype=float)
        for i in range(len(w)):
            if random.random() < self.mutation_rate:
                w[i] += np.random.normal(0, 0.2)
        return w

    

    def run(self):
        population = self.initialize_population()
        best_overall = None
        best_overall_fitness = -float("inf")

        for generation in range(1, self.generations + 1):
            fitness_scores = [self.fitness(weights) for weights in population]
            np.save("best_overall.npy", best_overall)
            # Generation stats
            gen_best_idx = int(np.argmax(fitness_scores))
            gen_best_fit = fitness_scores[gen_best_idx]
            gen_best_weights = population[gen_best_idx]

            if gen_best_fit > best_overall_fitness:
                best_overall_fitness = gen_best_fit
                best_overall = gen_best_weights

            print(
                f"Generation {generation}/{self.generations} | "
                f"Best this gen: {gen_best_fit:.2f} | "
                f"Best overall: {best_overall_fitness:.2f}"
            )

            # Create next generation
            parents = self.select_parents(population, fitness_scores)
            next_generation = []

            while len(next_generation) < self.population_size:
                p1 = random.choice(parents)
                p2 = random.choice(parents)
                c1, c2 = self.crossover(p1, p2)
                next_generation.append(self.mutate(c1))
                if len(next_generation) < self.population_size:
                    next_generation.append(self.mutate(c2))

            population = next_generation

        print("Training complete.")
        print("Best fitness achieved:", best_overall_fitness)
        print("Best weights:", best_overall)
        return best_overall
