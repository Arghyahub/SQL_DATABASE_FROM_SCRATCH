import { z } from "zod";
import constant from "./constant";
import { select, input, confirm } from "@inquirer/prompts";

const Menu = ["Create Table", "Insert Row", "Read Row", "Update Row"];

type ConstructorParams = {
  getTableMetadata: () => Promise<z.infer<typeof constant.tableSchemaArr>>;
  //   createTable: (tableData: z.infer<typeof constant.tableSchema>) => any;
};

class Tester {
  private getTableMetadata: () => Promise<
    z.infer<typeof constant.tableSchemaArr>
  >;
  private createTable: (tableData: z.infer<typeof constant.tableSchema>) => any;

  private checkEmpty(value: string, name: string = "Name") {
    return typeof value == "string" && value.trim().length > 0
      ? ""
      : `${name} cannot be empty`;
  }
  private checkProperName(value: string, name: string = "name") {
    if (typeof value !== "string") return `${name} must be a string`;
    return value.length == 0 ||
      value.startsWith("_") ||
      value.includes(" ") ||
      /[^a-zA-Z0-9_]/.test(value) ||
      (value.length > 0 && !isNaN(parseInt(value[0])))
      ? `${name} cannot start with _ or number and cannot contain special characters or space`
      : "";
  }
  private parseDataType(
    value: string,
    dataType: z.infer<typeof constant.columnSchema>["type"],
  ): [string | number | boolean | null, string] {
    if (typeof value !== "string") throw Error("Entered value is not string");
    let err = "";
    value = value.trim();
    switch (dataType) {
      case "string":
        return [value, ""];
      case "number":
        const num = Number(value);
        err = Number.isNaN(num) ? "Value should be a number" : "";
        return [Number.isNaN(num) ? null : num, err];
      case "boolean":
        err = ["true", "false"].includes(value)
          ? ""
          : "Value should be boolean";
        return [value === "true", ""];
    }
  }

  constructor({
    getTableMetadata,
    // , createTable
  }: ConstructorParams) {
    this.getTableMetadata = getTableMetadata;
    // this.createTable = createTable;
  }

  public async init() {
    process.on("SIGINT", () => {
      console.log("\nExiting...");
      process.exit(0);
    });

    while (true) {
      try {
        const answer = await select({
          message: "Choose an option from the menu",
          choices: [
            { name: "Create Table", value: "createTable" },
            { name: "Insert Row", value: "insertRow" },
            { name: "Read Row", value: "readRow" },
            { name: "Update Row", value: "updateRow" },
          ],
        });

        switch (answer) {
          case "createTable":
            const allTables = await this.getTableMetadata();

            const tableName = await input({
              message: "Enter table name:",
              validate: (value) => {
                const tableErr = this.checkProperName(value, "Table Name");
                if (tableErr.length > 0) return tableErr;
                const tableAlreadyExists = allTables.find(
                  (table) => table.table_name === tableName,
                );
                if (tableAlreadyExists) return "Table already exists";
                return true;
              },
            });

            const columns = [] as z.infer<typeof constant.columnSchemaArr>;
            let i = 0;
            while (true) {
              i++;
              const columnName = await input({
                message: `Enter column name ${i == 1 ? "" : "(Empty to skip)"}:`,
                validate: (value) => {
                  if (value.trim().length === 0) return true;
                  return this.checkProperName(value, "Column Name") || true;
                },
              });
              if (columnName.trim().length === 0) break;

              const columnType = await select({
                message: "Select Type",
                choices: constant.getDataTypes().map((type) => ({
                  name: type,
                  value: type,
                })),
              });

              const isPrimaryKey = await confirm({
                message: "Is Primary Key?",
                default: false,
              });

              //   No need ot check unique if primary key
              const isUnique = await confirm({
                message: "Is Unique?",
                default: false,
              });

              //   No need to check not null if primary key
              const isNullable = await confirm({
                message: "Is Not Null?",
                default: true,
              });

              const defaultValueInput = await input({
                message: "Enter Default Value(Empty to skip):",
                validate: (value) => {
                  value = value.trim();
                  if (value.trim().length === 0 && isNullable) return true;
                  const [_, err] = this.parseDataType(value, columnType);
                  return err || true;
                },
              });

              let [defaultValue] = this.parseDataType(
                defaultValueInput,
                columnType,
              );

              const references = await select({
                message:
                  "Choose reference table if to make column as a foreign key",
                choices: [
                  { name: "None", value: "null" },
                  ...allTables.map((tab) => ({
                    name: tab.table_name,
                    value: tab.table_name,
                  })),
                ],
              });

              const columnDetail = constant.columnSchema.parse({
                name: columnName,
                type: columnType,
                primary_key: isPrimaryKey,
                unique: isUnique,
                nullable: isNullable,
                default: defaultValue,
                references: references,
              });

              columns.push(columnDetail);
            }

            const tableDataInput = constant.tableSchema.parse({
              table_name: tableName,
              columns: columns,
            });

            console.log(
              "Table Data Here : \n",
              JSON.stringify(tableDataInput, null, 2),
            );

            break;
          case "insertRow":
            //   await this.insertRow();
            break;
          case "readRow":
            //   await this.readRow();
            break;
          case "updateRow":
            //   await this.updateRow();
            break;
        }

        console.log("\n");
      } catch (error) {
        if (error.name === "ExitPromptError") {
          console.log("\nExiting...");
          process.exit(0);
        }
        throw error;
      }
    }
  }
}

export default Tester;
