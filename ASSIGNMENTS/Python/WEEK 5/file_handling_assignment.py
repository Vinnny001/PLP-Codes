# File creation and writing
with open("my_file.txt", "w") as file:
    file.write("Learning Python is great.\n")
    file.write("Week 5 is amaizing\n")
    file.write("Accessing files is not that dificult\n")

# File reading and display
try:
    with open("my_file.txt", "r") as file:
        print("File Contents:")
        for line in file:
            print(line.strip())
except FileNotFoundError:
    print("File not found.")
except PermissionError:
    print("Permission denied.")
finally:
    print("File reading complete.")

# File appending
try:
    with open("my_file.txt", "a") as file:
        file.write("It involves functions\n")
        file.write("I was able to learn variables.\n")
        file.write("Error handling is also important\n")
except FileNotFoundError:
    print("File not found.")
except PermissionError:
    print("Permission denied.")
finally:
    print("File appending complete.")
