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
    const tableData = await this.getTableMetadata(tableName);
    const tableIdx = tableData.findIndex(
      (table) => table.table_name === tableName,
    );
    if (tableIdx === -1) throw Error("Table not found");

    const columns = tableData[tableIdx].columns;
    const columnValues = columns.map((column) => {
      if (column.is_serial) {
        column.last_serial_value += 1;
        return column.last_serial_value;
      } else {
        return this.getAppropriateValue({
          value: values[column.name],
          dataType: column.type,
          defaultValue: column.default,
          isNullable: column.nullable,
        });
      }
    });

    await this.insertIntoTable(tableName, columnValues);
    await this.updateTableMetadata(tableData);
  }
}

export default Helper;
