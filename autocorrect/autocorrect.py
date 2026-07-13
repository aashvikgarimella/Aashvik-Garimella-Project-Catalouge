import enchant
import string

d = enchant.Dict("en_US")

proximity_mixed_letters = {
    "A": ["S", "Q", "Z"], "S": ["A", "D", "W", "X"], "D": ["S", "F", "E", "C"],
    "F": ["D", "G", "R", "V"], "G": ["F", "H", "T", "B"], "Q": ["W", "A"],
    "W": ["Q", "E", "S"], "E": ["W", "R", "D"], "R": ["E", "T", "F"],
    "T": ["R", "Y", "G"], "Y": ["T", "U", "H"], "Z": ["A", "X"],
    "X": ["Z", "C", "S"], "C": ["X", "V", "D"], "V": ["C", "B", "F"],
    "B": ["V", "N", "G"], "N": ["B", "M", "H"], "M": ["N", "K", "J"],
    "O": ["I", "P", "L"], "P": ["O", "L"], "L": ["P", "K", "O"],
    "K": ["L", "J", "M"], "J": ["K", "H", "N"], "H": ["J", "G", "U"],
    "I": ["U", "O"], "U": ["Y", "I"],
}

shape_mixed_letters = {
    "I": ["L"], "L": ["I"], "B": ["D", "P"], "D": ["B"], "P": ["R", "B"],
    "R": ["P"], "Q": ["G"], "G": ["Q", "C"], "M": ["N"], "N": ["M"],
    "V": ["Y"], "Y": ["V"],
}


def find_similar_letters(letter):
    upper = letter.upper()
    return proximity_mixed_letters.get(upper, []) + shape_mixed_letters.get(upper, [])


def split_sentence(sentence):
    return [w.strip(string.punctuation) for w in sentence.split()]


def find_wrong_words(words):
    return [w for w in words if w and not d.check(w)]


def suggest_corrections(word, max_edits=2):
    results = set()
    frontier = {word}
    for _ in range(max_edits):
        next_frontier = set()
        for current in frontier:
            for index in range(len(current)):
                original = current[index]
                for replacement in find_similar_letters(original):
                    swapped = replacement.lower() if original.islower() else replacement
                    candidate = current[:index] + swapped + current[index + 1:]
                    if candidate == current:
                        continue
                    if d.check(candidate):
                        results.add(candidate)
                    next_frontier.add(candidate)
        frontier = next_frontier
    return sorted(results)


def main():
    text = input("Enter Sentence: ")
    words = split_sentence(text)
    wrong = find_wrong_words(words)
    if not wrong:
        print("No spelling issues found.")
        return
    for word in wrong:
        fixes = suggest_corrections(word)
        if fixes:
            print(f"{word} -> {', '.join(fixes)}")
        else:
            print(f"{word} -> no suggestions")


if __name__ == "__main__":
    main()
