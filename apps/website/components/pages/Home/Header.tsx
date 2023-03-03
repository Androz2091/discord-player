import { Button, createStyles, Text, Title } from '@mantine/core';
import Link from 'next/link';

const useStyles = createStyles((theme) => ({
    content: {
        paddingTop: theme.spacing.xl * 1,
        paddingBottom: theme.spacing.xl
    },
    title: {
        color: theme.white,
        fontFamily: `Greycliff CF, ${theme.fontFamily}`,
        fontWeight: 900,
        lineHeight: 1.05,
        maxWidth: 500,
        fontSize: 48
    },
    description: {
        color: theme.white,
        opacity: 0.75,
        maxWidth: 500,

        [theme.fn.smallerThan('md')]: {
            maxWidth: '100%'
        }
    },
    cta: {
        gap: '0.5rem',
        display: 'flex',
        marginTop: 10,
        flexDirection: 'row',
        [theme.fn.smallerThan('xs')]: {
            width: '100%',
            flexDirection: 'column'
        }
    },
    actionBtn: {
        [theme.fn.smallerThan('xs')]: {
            width: '100%'
        }
    }
}));

export function Header() {
    const { classes } = useStyles();

    return (
        <div className={classes.content}>
            <Title className={classes.title}>
                <Text component="span" inherit variant="gradient" gradient={{ from: 'yellow', to: 'red' }}>
                    Discord Player
                </Text>{' '}
                Imagine a Music Bot
            </Title>
            <Text className={classes.description} mt={30}>
                Discord Player is a complete framework to build your very own Discord music bot in JavaScript/TypeScript.
            </Text>
            <div className={classes.cta}>
                <Link href="/docs/classes/discord-player/Player" className={classes.actionBtn}>
                    <Button size="xl" className={`actionBtn ${classes.actionBtn}`}>
                        Documentation
                    </Button>
                </Link>
                <Link href="/docs/guides/welcome" className={classes.actionBtn}>
                    <Button size="xl" variant="outline" color="indigo" className={classes.actionBtn}>
                        Guides
                    </Button>
                </Link>
            </div>
        </div>
    );
}
