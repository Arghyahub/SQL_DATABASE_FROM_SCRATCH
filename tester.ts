import { z } from "zod";
import constant from "./constant";
import { select, input, confirm } from "@inquirer/prompts";

const Menu = ["Create Table", "Insert Row", "Read Row", "Update Row"];

type ConstructorParams = {
  getTableMetadata: () => Promise<z.infer<typeof constant.tableSchemaArr>>;
  createTable: (tableData: z.infer<typeof constant.tableSchema>) => any;
  insertIntoTable: (tableName: string, rowData: Record<string, any>) => any;
};

class Tester {
  private getTableMetadata: () => Promise<
    z.infer<typeof constant.tableSchemaArr>
  >;
  private createTable: (tableData: z.infer<typeof constant.tableSchema>) => any;
  private insertIntoTable: (
    tableName: string,
    rowData: Record<string, any>,
  ) => any;

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
        if (err.length > 0) return [null, err];
        return [value === "true", ""];
    }
  }

  constructor({
    getTableMetadata,
    createTable,
    insertIntoTable,
  }: ConstructorParams) {
    this.getTableMetadata = getTableMetadata;
    this.createTable = createTable;
    this.insertIntoTable = insertIntoTable;
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
            { name: "Exit", value: "exit" },
          ],
        });

        switch (answer) {
          case "createTable": {
            const allTables = await this.getTableMetadata();

            const tableName = await input({
              message: "Enter table name:",
              validate: (value) => {
                const tableErr = this.checkProperName(value, "Table Name");
                if (tableErr.length > 0) return tableErr;
                const tableAlreadyExists = allTables.find(
                  (table) => table.table_name === value,
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
                message: "Is Primary Key?(n) ",
                default: false,
              });

              let is_serial = false;
              if (isPrimaryKey && columnType === "number") {
                is_serial = await confirm({
                  message: "Is Serial?(n) ",
                  default: false,
                });
              }

              let isUnique = true,
                isNullable = false,
                defaultValue = null;

              if (!isPrimaryKey) {
                //   No need ot check unique if primary key
                isUnique = await confirm({
                  message: "Is Unique?(n) ",
                  default: false,
                });

                //   No need to check not null if primary key
                isNullable = await confirm({
                  message: "Is Null?(y) ",
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

                [defaultValue] = this.parseDataType(
                  defaultValueInput,
                  columnType,
                );
              }

              const columnDetail = constant.columnSchema.parse({
                name: columnName,
                type: columnType,
                is_serial: is_serial,
                primary_key: isPrimaryKey,
                unique: isUnique,
                nullable: isNullable,
                default: defaultValue,
              });

              columns.push(columnDetail);
              console.log("\n");
            }

            const tableDataInput = constant.tableSchema.parse({
              table_name: tableName,
              columns: columns,
            });

            console.log(`Table : ${tableDataInput.table_name}`);
            console.table(tableDataInput.columns);

            this.createTable(tableDataInput);
            console.log("\n");

            break;
          }
          case "insertRow": {
            const allTables = await this.getTableMetadata();
            if (allTables.length === 0) {
              console.error("No tables exist. Please create a table first.");
              break;
            }

            const tableName = await select({
              message: "Select table to insert row into:",
              choices: allTables.map((table) => ({
                name: table.table_name,
                value: table.table_name,
              })),
            });

            const table = allTables.find((t) => t.table_name === tableName);
            if (!table) break;

            const rowData: Record<string, any> = {};

            for (const column of table.columns) {
              if (column.is_serial) {
                rowData[column.name] = undefined;
                continue;
              }
              const value = await input({
                message: `Enter value for ${column.name} (${column.type})${
                  !column.nullable && column.default === null
                    ? " (Required)"
                    : " (Empty to skip)"
                }:`,
                validate: (val) => {
                  if (val.trim().length === 0) {
                    if (!column.nullable && column.default === null) {
                      return "skipping not allowed";
                    }
                    return true;
                  }
                  const [_, err] = this.parseDataType(val, column.type);
                  return err.length > 0 ? err : true;
                },
              });

              if (value.trim().length > 0) {
                const [parsedVal] = this.parseDataType(value, column.type);
                rowData[column.name] = parsedVal;
              }
            }

            const formatRows = Object.fromEntries(
              Object.entries(rowData).map(([key, value]) => [
                key,
                value === undefined ? "N/A" : value,
              ]),
            );
            console.log(`\nData to insert into ${tableName}:`);
            console.table([formatRows]);
            this.insertIntoTable(tableName, rowData);

            console.log("\n");
            break;
          }
          case "readRow":
            //   await this.readRow();
            break;
          case "updateRow":
            //   await this.updateRow();
            break;
          case "exit":
            process.exit(0);
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
