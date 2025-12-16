<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
    <?php
    if (have_posts()) {
        while (have_posts()) {
            the_post();
            ?>
            <article>
                <h1><?php the_title(); ?></h1>
                <section><?php the_content(); ?></section>
            </article>
            <?php
        }
    }
    ?>
    <?php wp_footer(); ?>
</body>
</html>
