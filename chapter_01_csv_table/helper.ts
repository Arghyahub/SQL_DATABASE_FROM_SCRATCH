import fs from "node:fs/promises";
import constant from "../constant";
import { z } from "zod";
import path from "path";

class Helper {
  public static async getTableMetadata(tableName?: string) {
    const allTablesFs = await fs.readFile(constant.getMetaDirPath(), "utf-8");
    const allTablesParsed = constant.tableSchemaArr.parse(
      JSON.parse(allTablesFs),
      {
        error: (_) => "[getTableMetadata] The table meta data is corrupted",
      },
    );
    if (tableName) {
      const table = allTablesParsed.find(
        (table) => table.table_name === tableName,
      );
      if (!table) throw Error("Table not found");
      return [table];
    }
    return allTablesParsed;
  }

  private static async insertIntoTable(
    tableName: string,
    rowData: z.infer<typeof constant.RowTypeSchema>[],
  ) {
    await fs.appendFile(
      constant.getTableStoragePath(tableName, "csv"),
      rowData.join(",") + "\n",
      "utf-8",
    );
  }

  public static async updateTableMetadata(
    allTables: z.infer<typeof constant.tableSchemaArr>,
  ) {
    const parsedTableData = constant.tableSchemaArr.parse(allTables, {
      error: (_) => "[updateTableMetadata] The table meta data is corrupted",
    });

    await fs.writeFile(
      constant.getMetaDirPath(),
      JSON.stringify(parsedTableData, null, 2),
      "utf-8",
    );
  }

  public static async createTableStorageFile(tableName: string) {
    const newStorageFile = constant.getTableStoragePath(tableName, "csv");
    await fs.writeFile(newStorageFile, "", "utf-8");
  }

  public static parseByDataType(
    value: any,
    dataType: z.infer<typeof constant.columnSchema>["type"],
  ) {
    if (value == null || value == "null") return null;
    switch (dataType) {
      case "string":
        return String(value);
      case "number":
        const num = Number(value);
        if (Number.isNaN(num)) throw Error("Value should be a number");
        return num;
      case "boolean":
        if (value !== "true" && value !== "false")
          throw Error("Value should be boolean");
        return value === "true";
      default:
        throw Error("Invalid data type");
    }
  }

  public static getAppropriateValue({
    value,
    dataType,
    defaultValue,
    isNullable,
  }: {
    value: any;
    dataType: z.infer<typeof constant.columnSchema>["type"];
    defaultValue: any;
    isNullable: boolean;
  }) {
    let ans: string | number | boolean | null = null;
    if (typeof value === "undefined") {
      ans = defaultValue;
    } else {
      ans = this.parseByDataType(value, dataType);
    }

    if (ans === null && !isNullable) throw Error("Value cannot be null");
    return ans;
  }

  public static async InsertIntoColumn(
    tableName: string,
    values: Record<string, string>,
  ) {
    const tableData = await this.getTableMetadata();
    const tableIdx = tableData.findIndex(
      (table) => table.table_name === tableName,
    );
    if (tableIdx === -1) throw Error("Table not found");

    const columns = tableData[tableIdx].columns;
    const columnValues = await Promise.all(
      columns.map(async (column) => {
        if (column.is_serial) {
          column.last_serial_value += 1;
          return column.last_serial_value;
        } else {
          const val = this.getAppropriateValue({
            value: values[column.name],
            dataType: column.type,
            defaultValue: column.default,
            isNullable: column.nullable,
          });

          if (column.unique && val !== null) {
            const rows = await this.ReadRow(
              tableName,
              { [column.name]: val },
              1,
            );
            if (rows.length > 0) throw Error("Value already exists");
          } else return val;
        }
      }),
    );

    await this.insertIntoTable(tableName, columnValues);
    await this.updateTableMetadata(tableData);
  }

  public static async ReadRow(
    tableName: string,
    where: Record<string, any>,
    take?: number,
  ) {
    const tableData = (await this.getTableMetadata(tableName))[0];
    if (!tableData) throw Error("Table not found");
    if (Number.isInteger(take) && take < 0)
      throw new Error("Take must be greater than 0");
    if (take == 0) return [];

    const columns = tableData.columns;
    const colToRec = {} as Record<number, any>;
    const whereKeys = Object.keys(where);
    columns.forEach((column, idx) => {
      if (whereKeys.includes(column.name)) {
        colToRec[idx] = this.parseByDataType(where[column.name], column.type);
      }
    });

    const csvFile = await fs.readFile(
      constant.getTableStoragePath(tableName, "csv"),
      "utf-8",
    );
    const rows = csvFile.split("\n");
    const result = [];
    for (const row of rows) {
      const col = row.split(",");
      let match = true;
      for (const key in colToRec) {
        if (col[key] != colToRec[key]) {
          match = false;
          break;
        }
      }
      if (match) {
        result.push(col);
        if (take && result.length === take) break;
      }
    }
    return result;
  }
}

export default Helper;
