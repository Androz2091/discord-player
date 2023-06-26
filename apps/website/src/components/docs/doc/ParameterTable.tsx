import { inter } from '@/lib/constants';
import { Paragraph, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@edge-ui/react';
import { CheckCircle, XCircle } from 'lucide-react';
import { DocumentedParameter } from 'typedoc-nextra';

export function ParameterTable({ parameters }: { parameters: DocumentedParameter[] }) {
    if (!parameters.length) return <></>;
    const hasDescription = parameters.some((p) => p.description != null);

    return (
        <Table className="border">
            <TableHeader className="bg-secondary">
                <TableRow>
                    <TableHead className="w-[100px]">Parameter</TableHead>
                    <TableHead>Type</TableHead>
                    {hasDescription ? <TableHead>Description</TableHead> : null}
                    <TableHead>Optional</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {parameters.map((param) => (
                    <TableRow key={param.name}>
                        <TableCell className="font-medium">{param.name}</TableCell>
                        <TableCell>{param.type || 'any'}</TableCell>
                        {hasDescription ? (
                            <TableCell>
                                <Paragraph>
                                    <pre className={inter.className}>{param.description}</pre>
                                </Paragraph>
                            </TableCell>
                        ) : null}
                        <TableCell>{param.optional ? <CheckCircle className="text-green-500" /> : <XCircle className="text-destructive" />}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
