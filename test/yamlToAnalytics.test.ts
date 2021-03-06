import fs from "fs";
import randomstring from "randomstring";
import ymlFilesToTypeFile, {
  getRefs, resolveReferencePaths, substituteRefs } from "../src/yamlToAnalytics";

test("resolveReferencePaths", () => {
  expect(resolveReferencePaths("/foo/bar", {
    $ref: "q.json",
    a: 1,
    b: [{
      c: {
        $ref: "z.json",
      },
    }],
  })).toEqual({
    $ref: "/foo/bar/q.json",
    a: 1,
    b: [{
      c: {
        $ref: "/foo/bar/z.json",
      },
    }],
  });
});

test("getRefs", () => {
  expect(getRefs({
    $ref: "q.json",
    a: 1,
    b: [{
      c: {
        $ref: "z.json",
      },
    }],
  })).toEqual(expect.arrayContaining([
    "q.json",
    "z.json",
  ]));
});

test("substituteRefs", () => {
  expect(substituteRefs({
    $ref: "q.json",
    a: 1,
    b: [{
      c: {
        $ref: "z.json",
      },
    }],
  }, {
    "q.json": "foo",
    "z.json": "bar",
  })).toEqual({
    $ref: "foo",
    a: 1,
    b: [{
      c: {
        $ref: "bar",
      },
    }],
  });
});

const SCHEMAS: any = {
  BaseType: `title: BaseType
type: object
properties:
  eventName:
    type: string
additionalProperties: false
required:
- eventName
`,

Post: `title: sends a post
type: object
properties:
  title:
    type: string
  content:
    type: string
extends:
  $ref: './BaseType.yml'
additionalProperties: false
required:
- title
- content
`,
User: `title: registers a user
type: object
properties:
  firstName:
    type: string
  lastName:
    type: string
  age:
    description: Age in years
    type: integer
    minimum: 0
  hairColor:
    enum:
    - black
    - brown
    - blue
    type: string
extends:
  $ref: './BaseType.yml'
additionalProperties: false
required:
- firstName
- lastName
`,
};

const TMP_DIR = "/tmp";
const PARENT_DIR = `${TMP_DIR}/.m33$hk4n_y4ml`;

const buildYamlAndTsDirs = () => {
  if (!fs.existsSync(PARENT_DIR)) {
    fs.mkdirSync(PARENT_DIR);
  }
  const dir = `${PARENT_DIR}/${randomstring.generate()}`;
  fs.mkdirSync(dir);
  const yamlDir = `${dir}/yaml`;
  const tsDir = `${dir}/ts`;
  fs.mkdirSync(yamlDir);
  fs.mkdirSync(tsDir);
  for (const SCHEMA of Object.keys(SCHEMAS)) {
    const yamlFile = `${yamlDir}/${SCHEMA}.yml`;
    fs.writeFileSync(yamlFile, SCHEMAS[SCHEMA]);
  }
  return [yamlDir, tsDir];
};

describe("Building TS from YAML spec", () => {
  let tsDir: string;
  let builtAnalyticsModule: any;
  const userId = "foobar";
  const anonymousId = "foobaranon";
  const userProperties = { firstName: "first" };
  beforeAll(async () => {
    let yamlDir: string;
    [yamlDir, tsDir] = buildYamlAndTsDirs();
    const targetTsFile = `${tsDir}/index.ts`;
    console.info(`Writing to ${targetTsFile}`);  // tslint:disable-line
    await ymlFilesToTypeFile(`${yamlDir}/**/*.yml`, targetTsFile);
    builtAnalyticsModule = await import(tsDir);
  });
  test("makes register a user event correctly", async () => {
    const registersAUserEvent = builtAnalyticsModule.makeRegistersAUser({ userId, properties: userProperties });
    expect(registersAUserEvent.userId).toBe(userId);
    expect(registersAUserEvent.properties.firstName).toBe(userProperties.firstName);
  });
  test("makes register a user event with anonymous ID", async () => {
    const registersAUserEvent = builtAnalyticsModule.makeRegistersAUser({ anonymousId, properties: { } });
    expect(registersAUserEvent.userId).toBeUndefined();
    expect(registersAUserEvent.anonymousId).toBe(anonymousId);
  });
});
