import { z } from "zod";
import path from "path";

class Contant {
  public readonly dataTypes = ["string", "number", "boolean"] as const;
  public readonly RowTypeSchema = z.union([
    z.string(),
    z.number(),
    z.boolean(),
  ]);
  private readonly dir_path = ".data" as const;
  private readonly meta_file = "metadata.json" as const;
  private dirname = __dirname;

  public setDirName(dirname: string) {
    this.dirname = dirname;
  }

  public readonly columnSchema = z.object({
    name: z.string(),
    type: z.enum(this.dataTypes),
    is_serial: z.boolean().default(false),
    last_serial_value: z.number().default(0),
    primary_key: z.boolean().default(false),
    unique: z.boolean().default(false),
    nullable: z.boolean().default(true),
    default: this.RowTypeSchema.nullable(),
  });

  public readonly columnSchemaArr = z.array(this.columnSchema);

  public readonly tableSchema = z.object({
    table_name: z.string(),
    columns: this.columnSchemaArr,
  });

  public readonly tableSchemaArr = z.array(this.tableSchema);

  // Dir
  public getDirPath() {
    return path.join(this.dirname, this.dir_path);
  }
  public getMetaDirPath() {
    return path.join(this.getDirPath(), this.meta_file);
  }
  public getTableStoragePath(tableName: string, extenstion: string) {
    return path.join(this.getDirPath(), `${tableName}.${extenstion}`);
  }

  // Data Types
  public getDataTypes() {
    return this.dataTypes;
  }
}

const constant = new Contant();
export default constant;
