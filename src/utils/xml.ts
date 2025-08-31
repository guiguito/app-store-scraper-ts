import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', textNodeName: 'label' });

export function parseXml<T = any>(xml: string): T {
  return parser.parse(xml) as T;
}

