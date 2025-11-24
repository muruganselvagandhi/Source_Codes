import csv

input_file = "T1.csv"   # change this to your file name
output_file = "arduino_formatted.txt"

lines = []

with open(input_file, "r") as f:
    reader = csv.reader(f)
    for row in reader:
        # row = [datetime, activePower, windSpeed, theoretical, direction]

        dt       = row[0]
        ap       = f"{float(row[1]):.7f}"   # trim precision
        ws       = f"{float(row[2]):.9f}"
        theo     = f"{float(row[3]):.7f}"
        wd       = f"{float(row[4]):.7f}"

        s = f"\"{dt},{ap},{ws},{theo},{wd}\","
        lines.append(s)

with open(output_file, "w") as f:
    f.write("const char* csvLines[] = {\n")
    for L in lines:
        f.write(f"  {L}\n")
    f.write("};\n")

print("✔ Conversion complete! Output saved to:", output_file)
